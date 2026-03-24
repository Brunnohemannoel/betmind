import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type RawEvent = Record<string, any>;

type SportKey = "football" | "basketball" | "tennis" | "esports";

type NormalizedMatch = {
  externalMatchId: string;
  sport: SportKey;
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string | null;
  status: "live" | "upcoming" | "finished";
  statusDetail: string;
  minute: number;
  homeScore: number;
  awayScore: number;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  totalOver25: number | null;
  totalUnder25: number | null;
  bttsYes: number | null;
  bttsNo: number | null;
  otherMarketCount: number;
  isHot: boolean;
};

type AiRiskLevel = "low" | "medium" | "high";

type UrgencyLevel = "normal" | "attention" | "urgent";

type TimeContext = {
  sport: SportKey;
  minute: number;
  phaseLabel: string;
  phaseKey: string;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  progressPct: number;
  isCriticalWindow: boolean;
  urgencyLevel: UrgencyLevel;
  snapshotAt: string;
};

const TARGET_LEAGUES = [
  "serie a",
  "série a",
  "brasileirao serie a",
  "brasileirão série a",
  "copa do brasil",
  "uefa champions",
  "champions league",
  "copa libertadores",
  "libertadores",
  "amistosos",
  "amistosos int",
  "jogos amistosos",
  "international friendly",
  "friendly international",
];

const SPORT_CONFIG: Record<SportKey, { sportIds: number[]; excludedKeywords: string[] }> = {
  football: { sportIds: [1], excludedKeywords: ["esoccer", "simulated", "youth"] },
  basketball: { sportIds: [18], excludedKeywords: ["simulated", "youth"] },
  tennis: { sportIds: [13], excludedKeywords: ["simulated", "youth"] },
  esports: { sportIds: [151, 190], excludedKeywords: ["simulated"] },
};

const MODE_SWITCH_MIN_MATCHES = 80;

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseScore = (rawScore: unknown) => {
  if (typeof rawScore !== "string") {
    return { homeScore: 0, awayScore: 0 };
  }

  const [home, away] = rawScore.split("-").map((part) => toNumber(part.trim(), 0));
  return { homeScore: home, awayScore: away };
};

const parseKickoff = (event: RawEvent): string | null => {
  const unix = Number(event?.time ?? event?.time_ts ?? event?.time_unix);
  if (Number.isFinite(unix) && unix > 0) {
    const ms = unix > 1_000_000_000_000 ? unix : unix * 1000;
    return new Date(ms).toISOString();
  }

  const raw = event?.time_str ?? event?.match_time ?? event?.start_time;
  if (typeof raw === "string") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return null;
};

const parseTimeFromStatusDetail = (statusDetail: string, fallbackMinutes: number) => {
  const normalized = normalizeText(statusDetail);
  const mmss = normalized.match(/(\d{1,2}):(\d{2})/);
  if (mmss) {
    const minute = toNumber(mmss[1], fallbackMinutes);
    const second = toNumber(mmss[2], 0);
    return Math.max(0, minute * 60 + second);
  }

  const minuteOnly = normalized.match(/(\d{1,3})\s*\+\s*(\d{1,2})/);
  if (minuteOnly) {
    return Math.max(0, (toNumber(minuteOnly[1], fallbackMinutes) + toNumber(minuteOnly[2], 0)) * 60);
  }

  return Math.max(0, fallbackMinutes * 60);
};

const computeUrgency = ({
  minute,
  pressure,
  maxEventChance,
}: {
  minute: number;
  pressure: number;
  maxEventChance: number;
}): { urgencyLevel: UrgencyLevel; isCriticalWindow: boolean } => {
  const isCriticalWindow = minute >= 80 && (pressure >= 70 || maxEventChance >= 65);
  if (isCriticalWindow) return { urgencyLevel: "urgent", isCriticalWindow: true };
  if (minute >= 70) return { urgencyLevel: "attention", isCriticalWindow: false };
  return { urgencyLevel: "normal", isCriticalWindow: false };
};

const resolveFootballPhase = (minute: number, status: NormalizedMatch["status"]) => {
  if (status === "upcoming") return { phaseLabel: "Pré-jogo", phaseKey: "pre_game" };
  if (status === "finished") return { phaseLabel: "Encerrado", phaseKey: "finished" };
  if (minute >= 90) return { phaseLabel: "Acréscimos", phaseKey: "stoppage" };
  if (minute >= 60) return { phaseLabel: "2º Tempo", phaseKey: "second_half" };
  if (minute >= 45) return { phaseLabel: "Intervalo", phaseKey: "halftime" };
  return { phaseLabel: "1º Tempo", phaseKey: "first_half" };
};

const buildTimeContext = (params: {
  sport: SportKey;
  status: NormalizedMatch["status"];
  statusDetail: string;
  minute: number;
  pressure: number;
  maxEventChance: number;
}): TimeContext => {
  const { sport, status, statusDetail, minute, pressure, maxEventChance } = params;

  if (sport === "football") {
    const phase = resolveFootballPhase(minute, status);
    const elapsedSeconds = parseTimeFromStatusDetail(statusDetail, minute);
    const regulationSeconds = 90 * 60;
    const remainingSeconds = status === "live" ? Math.max(0, regulationSeconds - elapsedSeconds) : status === "upcoming" ? regulationSeconds : 0;
    const progressPct = clampPct(status === "finished" ? 100 : Math.min(100, (elapsedSeconds / regulationSeconds) * 100));
    const urgency = computeUrgency({ minute, pressure, maxEventChance });

    return {
      sport,
      minute,
      phaseLabel: phase.phaseLabel,
      phaseKey: phase.phaseKey,
      elapsedSeconds,
      remainingSeconds,
      progressPct,
      isCriticalWindow: urgency.isCriticalWindow,
      urgencyLevel: urgency.urgencyLevel,
      snapshotAt: new Date().toISOString(),
    };
  }

  if (sport === "basketball") {
    const quarterFromLabel = (() => {
      const normalized = normalizeText(statusDetail);
      const q = normalized.match(/q\s*([1-4])/);
      if (q) return toNumber(q[1], 1);
      return Math.min(4, Math.max(1, Math.floor(minute / 12) + 1));
    })();

    const quarterMinute = Math.max(0, minute - (quarterFromLabel - 1) * 12);
    const quarterRemaining = Math.max(0, 12 * 60 - quarterMinute * 60);
    const elapsedSeconds = Math.max(0, minute * 60);
    const progressPct = clampPct(Math.min(100, (elapsedSeconds / (48 * 60)) * 100));
    const urgency = computeUrgency({ minute, pressure, maxEventChance });

    return {
      sport,
      minute,
      phaseLabel: `Q${quarterFromLabel}`,
      phaseKey: `q${quarterFromLabel}`,
      elapsedSeconds,
      remainingSeconds: quarterRemaining,
      progressPct,
      isCriticalWindow: urgency.isCriticalWindow,
      urgencyLevel: urgency.urgencyLevel,
      snapshotAt: new Date().toISOString(),
    };
  }

  if (sport === "tennis") {
    const normalized = normalizeText(statusDetail);
    const setMatch = normalized.match(/set\s*(\d+)/);
    const setNumber = setMatch ? toNumber(setMatch[1], 1) : Math.min(5, Math.max(1, Math.floor(minute / 30) + 1));
    const elapsedSeconds = Math.max(0, minute * 60);
    const progressPct = clampPct(Math.min(100, (setNumber / 5) * 100));
    const urgency = computeUrgency({ minute, pressure, maxEventChance });

    return {
      sport,
      minute,
      phaseLabel: `${setNumber}º Set`,
      phaseKey: `set_${setNumber}`,
      elapsedSeconds,
      remainingSeconds: null,
      progressPct,
      isCriticalWindow: urgency.isCriticalWindow,
      urgencyLevel: urgency.urgencyLevel,
      snapshotAt: new Date().toISOString(),
    };
  }

  const normalized = normalizeText(statusDetail);
  const mapMatch = normalized.match(/mapa?\s*(\d+)/);
  const mapNumber = mapMatch ? toNumber(mapMatch[1], 1) : Math.min(5, Math.max(1, Math.floor(minute / 12) + 1));
  const elapsedSeconds = Math.max(0, minute * 60);
  const progressPct = clampPct(Math.min(100, (elapsedSeconds / (45 * 60)) * 100));
  const urgency = computeUrgency({ minute, pressure, maxEventChance });

  return {
    sport,
    minute,
    phaseLabel: `Mapa ${mapNumber}`,
    phaseKey: `map_${mapNumber}`,
    elapsedSeconds,
    remainingSeconds: null,
    progressPct,
    isCriticalWindow: urgency.isCriticalWindow,
    urgencyLevel: urgency.urgencyLevel,
    snapshotAt: new Date().toISOString(),
  };
};

const buildTimeAlerts = (params: { timeContext: TimeContext; valueBet: boolean; maxEventChance: number }) => {
  const { timeContext, valueBet, maxEventChance } = params;
  const alerts: string[] = [];

  if (timeContext.minute >= 75 && maxEventChance >= 60) alerts.push("final_minutes");
  if (timeContext.isCriticalWindow) alerts.push("critical_moment");
  if (valueBet && timeContext.minute >= 75) alerts.push("value_before_end");

  return alerts;
};

const inferMinute = (event: RawEvent) =>
  toNumber(
    event?.timer?.tm ?? event?.time ?? event?.time_status_text?.replace(/\D/g, "") ?? event?.extra?.minute,
    0,
  );

const inferOdds = (event: RawEvent) => {
  const direct = event?.odds;
  if (direct && typeof direct === "object") {
    return {
      home: direct.home ? toNumber(direct.home, NaN) : NaN,
      draw: direct.draw ? toNumber(direct.draw, NaN) : NaN,
      away: direct.away ? toNumber(direct.away, NaN) : NaN,
    };
  }

  const fallback = event?.odds_1x2?.[0] ?? event?.main_odds;
  if (fallback && typeof fallback === "object") {
    return {
      home: fallback.home_od ?? fallback.home ? toNumber(fallback.home_od ?? fallback.home, NaN) : NaN,
      draw: fallback.draw_od ?? fallback.draw ? toNumber(fallback.draw_od ?? fallback.draw, NaN) : NaN,
      away: fallback.away_od ?? fallback.away ? toNumber(fallback.away_od ?? fallback.away, NaN) : NaN,
    };
  }

  return { home: NaN, draw: NaN, away: NaN };
};

type NumericPathValue = { path: string; value: number };

const collectNumericValues = (input: unknown, path = "root", bucket: NumericPathValue[] = []): NumericPathValue[] => {
  if (typeof input === "number" && Number.isFinite(input)) {
    bucket.push({ path: normalizeText(path), value: input });
    return bucket;
  }

  if (Array.isArray(input)) {
    input.forEach((item, index) => collectNumericValues(item, `${path}[${index}]`, bucket));
    return bucket;
  }

  if (input && typeof input === "object") {
    Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
      collectNumericValues(value, `${path}.${key}`, bucket);
    });
  }

  return bucket;
};

const pickByTokens = (values: NumericPathValue[], include: string[], exclude: string[] = []) => {
  const match = values.find(({ path }) => include.every((token) => path.includes(token)) && exclude.every((token) => !path.includes(token)));
  return match?.value ?? null;
};

const inferExtraMarkets = (event: RawEvent) => {
  const numericValues = collectNumericValues({
    odds: event?.odds,
    odds1x2: event?.odds_1x2,
    mainOdds: event?.main_odds,
    markets: event?.markets,
    ext: event?.extra,
    lines: event?.odds_lines,
  });

  const totalOver25 = pickByTokens(numericValues, ["over", "2.5"]);
  const totalUnder25 = pickByTokens(numericValues, ["under", "2.5"]);
  const bttsYes =
    pickByTokens(numericValues, ["btts", "yes"]) ??
    pickByTokens(numericValues, ["both", "yes"]) ??
    pickByTokens(numericValues, ["gg"]);
  const bttsNo =
    pickByTokens(numericValues, ["btts", "no"]) ??
    pickByTokens(numericValues, ["both", "no"]) ??
    pickByTokens(numericValues, ["ng"]);

  const marketPathSet = new Set(
    numericValues
      .map((entry) => entry.path)
      .filter(
        (path) =>
          path.includes("over") ||
          path.includes("under") ||
          path.includes("btts") ||
          path.includes("both") ||
          path.includes("corner") ||
          path.includes("card") ||
          path.includes("handicap"),
      ),
  );

  const knownMarketCount = [totalOver25, totalUnder25, bttsYes, bttsNo].filter((value) => typeof value === "number").length;
  const otherMarketCount = Math.max(0, Math.min(99, marketPathSet.size - knownMarketCount));

  return {
    totalOver25,
    totalUnder25,
    bttsYes,
    bttsNo,
    otherMarketCount,
  };
};

const inferStatusDetail = (event: RawEvent, fallback: "live" | "upcoming" | "finished") => {
  const label =
    event?.time_status_text ?? event?.status ?? event?.timer?.status ?? event?.stage ?? event?.match_status;

  if (typeof label === "string" && label.trim()) return label.trim();

  if (fallback === "upcoming") return "Agendado";
  if (fallback === "finished") return "Finalizado";
  return "Ao vivo";
};

const shouldIncludeLeague = (leagueName: string, sport: SportKey, excludedKeywords: string[]) => {
  if (sport !== "football") return true;
  const normalized = normalizeText(leagueName);
  if (excludedKeywords.some((blocked) => normalized.includes(normalizeText(blocked)))) return false;
  return TARGET_LEAGUES.some((allowed) => normalized.includes(normalizeText(allowed)));
};

const leagueMatchesKeywords = (leagueName: string, keywords: string[]) => {
  if (keywords.length === 0) return false;
  const normalizedLeague = normalizeText(leagueName);
  return keywords.some((keyword) => normalizedLeague.includes(normalizeText(keyword)));
};

const parseFocusLeagueKeywords = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .slice(0, 12);
  }

  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  return [];
};

const prioritizeByFocusLeague = (matches: NormalizedMatch[], focusKeywords: string[]) => {
  if (focusKeywords.length === 0) return matches;
  const focused = matches.filter((match) => leagueMatchesKeywords(match.league, focusKeywords));
  const others = matches.filter((match) => !leagueMatchesKeywords(match.league, focusKeywords));
  return [...focused, ...others];
};

const normalizeCore = (
  event: RawEvent,
  status: "live" | "upcoming" | "finished",
  sport: SportKey,
  excludedKeywords: string[],
  usePriority = true,
): NormalizedMatch | null => {
  const league =
    event?.league?.name ??
    event?.league?.long_name ??
    event?.league_name ??
    event?.competition?.name ??
    event?.league?.cc ??
    "";

  const homeTeam = event?.home?.name ?? event?.home?.long_name ?? event?.home_name ?? "";
  const awayTeam = event?.away?.name ?? event?.away?.long_name ?? event?.away_name ?? "";

  if (!league || !homeTeam || !awayTeam) return null;

  const normalizedLeague = league.toLowerCase();
  if (excludedKeywords.some((blocked) => normalizedLeague.includes(blocked))) return null;
  if (usePriority && !shouldIncludeLeague(league, sport, excludedKeywords)) return null;

  const inferredMinute = inferMinute(event);
  const minute = status === "upcoming" ? 0 : status === "finished" ? 90 : inferredMinute > 130 ? 0 : inferredMinute;
  const { homeScore, awayScore } = parseScore(event?.ss ?? event?.score);
  const odds = inferOdds(event);
  const extraMarkets = inferExtraMarkets(event);
  const statusDetail = inferStatusDetail(event, status);
  const kickoffAt = parseKickoff(event);

  const hotSignals = [
    status === "live",
    minute >= 68,
    Math.abs(homeScore - awayScore) <= 1,
    Number.isFinite(odds.home) && odds.home <= 2.2,
    Number.isFinite(odds.away) && odds.away <= 2.2,
  ].filter(Boolean).length;

  return {
    externalMatchId: String(event?.id ?? `${league}-${homeTeam}-${awayTeam}-${status}`),
    sport,
    league,
    homeTeam,
    awayTeam,
    kickoffAt,
    status,
    statusDetail,
    minute,
    homeScore,
    awayScore,
    oddsHome: Number.isFinite(odds.home) ? odds.home : null,
    oddsDraw: Number.isFinite(odds.draw) ? odds.draw : null,
    oddsAway: Number.isFinite(odds.away) ? odds.away : null,
    totalOver25: extraMarkets.totalOver25,
    totalUnder25: extraMarkets.totalUnder25,
    bttsYes: extraMarkets.bttsYes,
    bttsNo: extraMarkets.bttsNo,
    otherMarketCount: extraMarkets.otherMarketCount,
    isHot: hotSignals >= 3,
  };
};

const normalizeByStatus = (
  event: RawEvent,
  status: "live" | "upcoming" | "finished",
  sport: SportKey,
  excludedKeywords: string[],
  usePriority = true,
) => normalizeCore(event, status, sport, excludedKeywords, usePriority);

const pickPriorityWithFallback = (
  events: RawEvent[],
  status: "live" | "upcoming" | "finished",
  sport: SportKey,
  excludedKeywords: string[],
  limit: number,
  usePriorityFilter: boolean,
) => {
  let priority = events
    .map((event) => normalizeByStatus(event, status, sport, excludedKeywords, usePriorityFilter))
    .filter((match): match is NormalizedMatch => Boolean(match));

  if (priority.length >= limit) return priority.slice(0, limit);

  if (!usePriorityFilter) return priority.slice(0, limit);

  const fallback = events
    .map((event) => normalizeByStatus(event, status, sport, excludedKeywords, false))
    .filter((match): match is NormalizedMatch => Boolean(match));

  const merged = new Map<string, NormalizedMatch>();
  [...priority, ...fallback].forEach((match) => {
    if (!merged.has(match.externalMatchId)) merged.set(match.externalMatchId, match);
  });

  priority = [...merged.values()];
  return priority.slice(0, limit);
};

const dedupeRawEvents = (events: RawEvent[]) => {
  const deduped = new Map<string, RawEvent>();
  events.forEach((event) => {
    const fallbackKey = `${event?.league?.name ?? event?.league_name ?? "-"}-${event?.home?.name ?? event?.home_name ?? "-"}-${event?.away?.name ?? event?.away_name ?? "-"}-${event?.time ?? event?.time_ts ?? event?.time_unix ?? "-"}`;
    const key = String(event?.id ?? fallbackKey);
    if (!deduped.has(key)) deduped.set(key, event);
  });
  return [...deduped.values()];
};

const fetchBetsApiFirst = async (candidates: string[]) => {
  for (const candidate of candidates) {
    const response = await fetch(candidate, { headers: { "Content-Type": "application/json" } });
    if (!response.ok) continue;
    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];
    if (results.length > 0) return results as RawEvent[];
  }
  return [] as RawEvent[];
};

const fetchBetsApiMerged = async (candidates: string[]) => {
  const merged: RawEvent[] = [];

  for (const candidate of candidates) {
    const response = await fetch(candidate, { headers: { "Content-Type": "application/json" } });
    if (!response.ok) continue;
    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];
    if (results.length > 0) merged.push(...results);
  }

  return dedupeRawEvents(merged);
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const toPct = (value: number) => Math.round(clamp01(value) * 100);

const implied = (odd: number | null) => (odd && odd > 0 ? 1 / odd : 0.33);

const normalizeTriplet = (h: number, d: number, a: number) => {
  const sum = h + d + a || 1;
  return {
    h: h / sum,
    d: d / sum,
    a: a / sum,
  };
};

const clampPct = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const pickBestBet = (params: {
  valueHome: boolean;
  valueAway: boolean;
  valueDraw: boolean;
  over15: number;
  cornerProb: number;
  cardProb: number;
  homeName: string;
  awayName: string;
}) => {
  const { valueHome, valueAway, valueDraw, over15, cornerProb, cardProb, homeName, awayName } = params;

  if (valueHome) {
    return {
      market: `Vitória ${homeName}`,
      confidence: clampPct(68 + over15 * 22),
      rationale: `Mandante acima do preço justo. Janela agressiva de entrada agora.`,
      cta: "Apostar agora",
    };
  }

  if (valueAway) {
    return {
      market: `Vitória ${awayName}`,
      confidence: clampPct(66 + over15 * 20),
      rationale: `Visitante com valor claro e mercado atrasado.`,
      cta: "Apostar agora",
    };
  }

  if (valueDraw) {
    return {
      market: "Empate",
      confidence: clampPct(60 + over15 * 14),
      rationale: "Equilíbrio forte e odd ainda interessante.",
      cta: "Apostar agora",
    };
  }

  if (over15 >= 0.58) {
    return {
      market: "Over 1.5 gols",
      confidence: clampPct(over15 * 100),
      rationale: "Ritmo alto e pressão sustentada. O gol pode sair a qualquer momento.",
      cta: "Apostar agora",
    };
  }

  if (cornerProb >= 0.63) {
    return {
      market: "Over escanteios",
      confidence: clampPct(cornerProb * 100),
      rationale: "Ataques pelos lados em sequência, tendência forte de cantos.",
      cta: "Apostar agora",
    };
  }

  return {
    market: "Over cartões",
    confidence: clampPct(cardProb * 100),
    rationale: "Jogo físico e disputado, cenário ideal para cartões.",
    cta: "Apostar agora",
  };
};

const buildChartSeries = (params: {
  status: "live" | "upcoming" | "finished";
  pressure: number;
  momentum: number;
  homeProb: number;
  drawProb: number;
  awayProb: number;
  goalPct: number;
  cornerPct: number;
  cardPct: number;
}) => {
  const { status, pressure, momentum, homeProb, drawProb, awayProb, goalPct, cornerPct, cardPct } = params;
  const labels = status === "upcoming" ? ["Pré 60", "Pré 45", "Pré 30", "Pré 15", "Kickoff", "Janela"] : ["15'", "30'", "45'", "60'", "75'", "90'"];

  const pressureTimeline = labels.map((label, idx) => {
    const swing = status === "upcoming" ? (idx - 2) * 4 : (idx - 1) * 6;
    const home = clampPct(pressure + swing);
    const away = clampPct(100 - home + (momentum > 60 ? -4 : 4));
    return { label, home, away };
  });

  const eventTimeline = labels.map((label, idx) => {
    const weight = 0.78 + idx * 0.08;
    return {
      label,
      goals: clampPct(goalPct * weight),
      corners: clampPct(cornerPct * (0.72 + idx * 0.09)),
      cards: clampPct(cardPct * (0.7 + idx * 0.1)),
    };
  });

  const probabilityTimeline = labels.map((label, idx) => {
    const delta = idx - 2;
    const home = clampPct(homeProb + delta * 2.2);
    const draw = clampPct(drawProb - Math.abs(delta) * 1.1);
    const away = clampPct(100 - home - draw);
    return { label, home, draw, away: Math.max(0, away) };
  });

  return { pressureTimeline, eventTimeline, probabilityTimeline };
};

const fetchLogo = async (teamName: string) => {
  try {
    const endpoint = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`;
    const response = await fetch(endpoint);
    if (!response.ok) return null;
    const data = await response.json();
    const team = data?.teams?.[0];
    return typeof team?.strBadge === "string" ? team.strBadge : null;
  } catch {
    return null;
  }
};

const stringifyError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const BETSAPI_TOKEN = Deno.env.get("BETSAPI_TOKEN");
    if (!BETSAPI_TOKEN) {
      throw new Error("BETSAPI_TOKEN is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!SUPABASE_URL) {
      throw new Error("SUPABASE_URL is not configured");
    }

    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const limit = Number.isFinite(Number(body?.limit)) ? Number(body.limit) : 24;
    const focusLeagueKeywords = parseFocusLeagueKeywords(body?.focusLeague);
    const selectedSport: SportKey = ["football", "basketball", "tennis", "esports"].includes(body?.sport)
      ? body.sport
      : "football";
    const sportConfig = SPORT_CONFIG[selectedSport];
    const usePriorityFilter = selectedSport === "football";

    const inplayCandidates = sportConfig.sportIds.flatMap((sportId) => [
      `https://api.b365api.com/v3/events/inplay?sport_id=${sportId}&token=${BETSAPI_TOKEN}`,
      `https://api.b365api.com/v1/bet365/inplay?sport_id=${sportId}&token=${BETSAPI_TOKEN}`,
    ]);

    const upcomingCandidates = sportConfig.sportIds.flatMap((sportId) => [
      ...["today", "tomorrow"].flatMap((day) =>
        [1, 2, 3, 4].map(
          (page) =>
            `https://api.b365api.com/v3/events/upcoming?sport_id=${sportId}&day=${day}&page=${page}&token=${BETSAPI_TOKEN}`,
        ),
      ),
      ...[1, 2, 3, 4].map(
        (page) => `https://api.b365api.com/v3/events/upcoming?sport_id=${sportId}&page=${page}&token=${BETSAPI_TOKEN}`,
      ),
      ...[1, 2].map(
        (page) => `https://api.b365api.com/v1/bet365/upcoming?sport_id=${sportId}&page=${page}&token=${BETSAPI_TOKEN}`,
      ),
    ]);

    const endedCandidates = sportConfig.sportIds.flatMap((sportId) => [
      `https://api.b365api.com/v3/events/ended?sport_id=${sportId}&page=1&token=${BETSAPI_TOKEN}`,
      `https://api.b365api.com/v3/events/ended?sport_id=${sportId}&token=${BETSAPI_TOKEN}`,
      `https://api.b365api.com/v1/bet365/ended?sport_id=${sportId}&token=${BETSAPI_TOKEN}`,
    ]);

    const [liveRaw, upcomingRaw, finishedRaw] = await Promise.all([
      fetchBetsApiFirst(inplayCandidates),
      fetchBetsApiMerged(upcomingCandidates),
      fetchBetsApiFirst(endedCandidates),
    ]);

    const upcomingWorkLimit = selectedSport === "football" ? Math.max(limit * 3, 120) : Math.max(limit * 2, 64);

    const liveNormalized = pickPriorityWithFallback(
      liveRaw,
      "live",
      selectedSport,
      sportConfig.excludedKeywords,
      limit,
      usePriorityFilter,
    );
    const upcomingNormalized = pickPriorityWithFallback(
      upcomingRaw,
      "upcoming",
      selectedSport,
      sportConfig.excludedKeywords,
      upcomingWorkLimit,
      usePriorityFilter,
    );
    const finishedNormalized = pickPriorityWithFallback(
      finishedRaw,
      "finished",
      selectedSport,
      sportConfig.excludedKeywords,
      limit,
      usePriorityFilter,
    );

    const now = new Date();
    const upcomingFiltered = upcomingNormalized.filter((match) => {
      if (!match.kickoffAt) return true;
      const kickoff = new Date(match.kickoffAt);
      // Remove matches that should have started more than 3 minutes ago
      return kickoff.getTime() > now.getTime() - 3 * 60 * 1000;
    });

    const upcomingPrioritized = prioritizeByFocusLeague(upcomingFiltered, focusLeagueKeywords).slice(0, limit);

    const statusPriority: Record<NormalizedMatch["status"], number> = {
      live: 3,
      upcoming: 2,
      finished: 1,
    };

    const normalizedMap = new Map<string, NormalizedMatch>();
    [...liveNormalized, ...upcomingPrioritized, ...finishedNormalized].forEach((match) => {
      const existing = normalizedMap.get(match.externalMatchId);
      if (!existing || statusPriority[match.status] >= statusPriority[existing.status]) {
        normalizedMap.set(match.externalMatchId, match);
      }
    });
    const normalized = [...normalizedMap.values()];

    if (normalized.length === 0) {
      return new Response(
        JSON.stringify({
          live: [],
          upcoming: [],
          finished: [],
          sport: selectedSport,
          updatedAt: new Date().toISOString(),
          source: "betsapi",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const uniqueTeamNames = [...new Set(normalized.flatMap((m) => [m.homeTeam, m.awayTeam]))];

    const { data: teamsUpserted, error: teamsUpsertError } = await supabase
      .from("teams")
      .upsert(uniqueTeamNames.map((name) => ({ name })), { onConflict: "name" })
      .select("id, name, logo_url");

    if (teamsUpsertError) throw teamsUpsertError;

    const teamMap = new Map((teamsUpserted ?? []).map((team) => [team.name, team]));
    const teamIds = (teamsUpserted ?? []).map((team) => team.id);

    const logoByTeamId = new Map<string, string>();
    if (teamIds.length > 0) {
      const { data: cachedLogos, error: logosReadError } = await supabase
        .from("team_logos")
        .select("team_id, logo_url")
        .eq("provider", "thesportsdb")
        .in("team_id", teamIds);

      if (logosReadError) throw logosReadError;
      (cachedLogos ?? []).forEach((row) => {
        logoByTeamId.set(row.team_id, row.logo_url);
      });
    }

    const missingLogoTeams = (teamsUpserted ?? []).filter((team) => !logoByTeamId.has(team.id));
    const fetchedLogos = await Promise.all(
      missingLogoTeams.map(async (team) => ({
        teamId: team.id,
        teamName: team.name,
        logoUrl: await fetchLogo(team.name),
      })),
    );

    const toInsert = fetchedLogos.filter((item) => item.logoUrl);
    if (toInsert.length > 0) {
      const { error: logosInsertError } = await supabase.from("team_logos").upsert(
        toInsert.map((item) => ({
          team_id: item.teamId,
          provider: "thesportsdb",
          logo_url: item.logoUrl,
        })),
        { onConflict: "team_id,provider" },
      );
      if (logosInsertError) throw logosInsertError;

      await Promise.all(
        toInsert.map((item) =>
          supabase.from("teams").update({ logo_url: item.logoUrl }).eq("id", item.teamId),
        ),
      );
    }

    const allLogos = new Map<string, string | null>();
    (teamsUpserted ?? []).forEach((team) => {
      const fetched = toInsert.find((i) => i.teamId === team.id)?.logoUrl ?? null;
      allLogos.set(team.id, logoByTeamId.get(team.id) ?? team.logo_url ?? fetched);
    });

    const upsertRows = normalized
      .map((match) => {
        const home = teamMap.get(match.homeTeam);
        const away = teamMap.get(match.awayTeam);
        if (!home || !away) return null;

        return {
          external_match_id: match.externalMatchId,
          league: match.league,
          home_team_id: home.id,
          away_team_id: away.id,
          home_score: safeNumber(match.homeScore, 0),
          away_score: safeNumber(match.awayScore, 0),
          minute: safeNumber(match.minute, 0),
          status: match.status,
          status_detail: match.statusDetail,
          kickoff_at: match.kickoffAt,
          odds_home: match.oddsHome,
          odds_draw: match.oddsDraw,
          odds_away: match.oddsAway,
          is_hot: match.isHot,
        };
      })
      .filter(Boolean);

    const { data: liveRows, error: upsertMatchesError } = await supabase
      .from("matches_live")
      .upsert(upsertRows, { onConflict: "external_match_id" })
      .select("id, external_match_id, league, minute, home_score, away_score, is_hot, odds_home, odds_draw, odds_away, home_team_id, away_team_id, status, status_detail, kickoff_at");

    if (upsertMatchesError) throw upsertMatchesError;

    // Routine to sweep and cleanup stale data from matches_live
    try {
      const nowOffset = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
      const finishedOffset = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      
      await Promise.all([
        // Delete finished matches older than 2 hours
        supabase.from("matches_live").delete().eq("status", "finished").lt("updated_at", finishedOffset),
        // Delete upcoming matches that should have started > 30 mins ago but weren't moved to live/finished
        supabase.from("matches_live").delete().eq("status", "upcoming").lt("kickoff_at", nowOffset)
      ]);
    } catch (err) {
      console.warn("Cleanup routine warning:", err);
    }

    const involvedTeamIds = [
      ...new Set((liveRows ?? []).flatMap((row) => [row.home_team_id, row.away_team_id]).filter(Boolean)),
    ];

    const [teamStatsResponse, historyCountResponse] = await Promise.all([
      involvedTeamIds.length > 0
        ? supabase.from("team_stats").select("team_id, win_rate, avg_goals, avg_corners, avg_cards").in("team_id", involvedTeamIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("matches_history").select("id", { count: "exact", head: true }),
    ]);

    if (teamStatsResponse.error) throw teamStatsResponse.error;

    const teamStats = teamStatsResponse.data ?? [];
    const historyCount = historyCountResponse.count ?? 0;
    const normalizedByExternalId = new Map(normalized.map((match) => [match.externalMatchId, match]));

    const teamStatsMap = new Map((teamStats ?? []).map((row) => [row.team_id, row]));
    const modelMode = historyCount >= MODE_SWITCH_MIN_MATCHES ? "predictive" : "hybrid";

    const matches = (liveRows ?? []).map((row) => {
      const home = (teamsUpserted ?? []).find((team) => team.id === row.home_team_id);
      const away = (teamsUpserted ?? []).find((team) => team.id === row.away_team_id);
      const homeStats = row.home_team_id ? teamStatsMap.get(row.home_team_id) : undefined;
      const awayStats = row.away_team_id ? teamStatsMap.get(row.away_team_id) : undefined;

      const impliedHome = implied(row.odds_home);
      const impliedDraw = implied(row.odds_draw);
      const impliedAway = implied(row.odds_away);

      const homeBoost = Number(homeStats?.win_rate ?? 0) * 0.16 + Number(homeStats?.avg_goals ?? 0) * 0.04;
      const awayBoost = Number(awayStats?.win_rate ?? 0) * 0.16 + Number(awayStats?.avg_goals ?? 0) * 0.04;

      const pRaw = normalizeTriplet(
        impliedHome + homeBoost,
        impliedDraw + 0.03,
        impliedAway + awayBoost,
      );

      const scoreDiff = Math.abs(Number(row.home_score ?? 0) - Number(row.away_score ?? 0));
      const minute = Number(row.minute ?? 0);
      const pressure = Math.round(
        Math.min(
          100,
          38 + minute * 0.55 + (row.is_hot ? 20 : 0) + (scoreDiff <= 1 ? 8 : 0) + Number(homeStats?.avg_corners ?? 0) * 2,
        ),
      );
      const momentum = Math.round(Math.min(100, 25 + minute * 0.7 + (row.is_hot ? 15 : 0)));
      const dominance = Math.round(Math.min(100, 40 + (pRaw.h - pRaw.a) * 80 + Number(homeStats?.win_rate ?? 0) * 20));

      const goalNext10 = clamp01(0.18 + pressure / 220 + (scoreDiff === 0 ? 0.09 : 0.03));
      const over05 = clamp01(goalNext10 + 0.26);
      const over15 = clamp01(goalNext10 + 0.12);
      const over25 = clamp01(goalNext10 - 0.02 + Number(homeStats?.avg_goals ?? 0) * 0.05);
      const cornerProb = clamp01(0.22 + Number(homeStats?.avg_corners ?? 0) * 0.08 + pressure / 300);
      const cardProb = clamp01(0.2 + Number(homeStats?.avg_cards ?? 0) * 0.12 + minute / 250);

      const valueHome = row.odds_home ? pRaw.h > impliedHome + 0.05 : false;
      const valueAway = row.odds_away ? pRaw.a > impliedAway + 0.05 : false;
      const valueDraw = row.odds_draw ? pRaw.d > impliedDraw + 0.05 : false;
      const valueBet = valueHome || valueAway || valueDraw;

      const hotGame = pressure >= 76 && momentum >= 68;
      const comebackSignal =
        row.status === "live" &&
        ((Number(row.home_score ?? 0) < Number(row.away_score ?? 0) && pRaw.h >= 0.42) ||
          (Number(row.away_score ?? 0) < Number(row.home_score ?? 0) && pRaw.a >= 0.42));
      const idealMoment = valueBet && goalNext10 >= 0.55;
      const riskHigh = row.status !== "live" || pressure < 45;
      const confidence = clamp01(0.48 + (hotGame ? 0.22 : 0) + (valueBet ? 0.14 : 0) - (riskHigh ? 0.11 : 0));

      const trend = pressure >= 74 ? "subindo" : pressure <= 45 ? "caindo" : "estavel";
      const rhythm = momentum >= 72 ? "acelerado" : momentum <= 42 ? "lento" : "moderado";

      const riskLevel: AiRiskLevel = riskHigh ? (confidence < 0.5 ? "high" : "medium") : confidence >= 0.72 ? "low" : "medium";

      const bestBet = pickBestBet({
        valueHome,
        valueAway,
        valueDraw,
        over15,
        cornerProb,
        cardProb,
        homeName: home?.name ?? "Mandante",
        awayName: away?.name ?? "Visitante",
      });

      const eventChances = {
        goal: toPct(goalNext10),
        corner: toPct(cornerProb),
        card: toPct(cardProb),
      };

      const maxEventChance = Math.max(eventChances.goal, eventChances.corner, eventChances.card);
      const timeContext = buildTimeContext({
        sport: selectedSport,
        status: row.status,
        statusDetail: row.status_detail ?? "",
        minute,
        pressure,
        maxEventChance,
      });

      const charts = buildChartSeries({
        status: row.status,
        pressure,
        momentum,
        homeProb: toPct(pRaw.h),
        drawProb: toPct(pRaw.d),
        awayProb: toPct(pRaw.a),
        goalPct: eventChances.goal,
        cornerPct: eventChances.corner,
        cardPct: eventChances.card,
      });

      const alerts = [
        goalNext10 >= 0.66 ? "goal_imminent" : null,
        cornerProb >= 0.7 ? "corners_hot" : null,
        riskLevel === "high" ? "risk_alert" : null,
        valueBet ? "value_odd" : null,
        ...buildTimeAlerts({ timeContext, valueBet, maxEventChance }),
      ].filter((item): item is string => Boolean(item));

      const insight = hotGame
        ? `🔥 ${home?.name ?? "Mandante"} está empurrando o jogo: pressão ${pressure}% e chance real de ação imediata.`
        : `📊 Leitura rápida: ritmo ${rhythm}, pressão ${pressure}% e jogo pronto para entrada oportunista.`;

      let suggestion = "👉 Entrada recomendada: Over 1.5 gols";
      if (valueHome) suggestion = `👉 Entrada recomendada: Vitória ${home?.name ?? "mandante"}`;
      else if (valueAway) suggestion = `👉 Entrada recomendada: Vitória ${away?.name ?? "visitante"}`;
      else if (cornerProb >= 0.63) suggestion = "👉 Entrada recomendada: Over escanteios";
      else if (cardProb >= 0.6) suggestion = "👉 Entrada recomendada: Over cartões";

      const tags = {
        hot: hotGame,
        value: valueBet,
        ideal: idealMoment,
        highRisk: riskHigh,
        comeback: comebackSignal,
      };

      return {
        id: row.id,
        externalMatchId: row.external_match_id,
        league: row.league,
        kickoffAt: row.kickoff_at,
        status: row.status,
        statusDetail: row.status_detail,
        minute: row.minute,
        homeScore: row.home_score,
        awayScore: row.away_score,
        isHot: row.is_hot,
        odds: {
          home: row.odds_home,
          draw: row.odds_draw,
          away: row.odds_away,
          totalOver25: normalizedByExternalId.get(row.external_match_id)?.totalOver25 ?? null,
          totalUnder25: normalizedByExternalId.get(row.external_match_id)?.totalUnder25 ?? null,
          bttsYes: normalizedByExternalId.get(row.external_match_id)?.bttsYes ?? null,
          bttsNo: normalizedByExternalId.get(row.external_match_id)?.bttsNo ?? null,
          otherMarketCount: normalizedByExternalId.get(row.external_match_id)?.otherMarketCount ?? 0,
        },
        homeTeam: {
          id: home?.id,
          name: home?.name ?? "Casa",
          logoUrl: home?.id ? allLogos.get(home.id) : null,
        },
        awayTeam: {
          id: away?.id,
          name: away?.name ?? "Visitante",
          logoUrl: away?.id ? allLogos.get(away.id) : null,
        },
        ai: {
          modelMode,
          confidence: toPct(confidence),
          pressure,
          momentum,
          dominance,
          trend,
          winHome: toPct(pRaw.h),
          winDraw: toPct(pRaw.d),
          winAway: toPct(pRaw.a),
          goalNext10: toPct(goalNext10),
          over05: toPct(over05),
          over15: toPct(over15),
          over25: toPct(over25),
          cornerOver: toPct(cornerProb),
          cardOver: toPct(cardProb),
          insight,
          suggestion,
          riskLevel,
          bestBet,
          statusSignals: {
            pressure,
            rhythm,
            trend,
          },
          eventChances,
          charts,
          alerts: [...new Set(alerts)],
          tags,
        },
        timeContext,
      };
    });

    if (matches.length > 0) {
      const predictionRows = matches.map((match) => ({
        match_live_id: match.id,
        win_home_prob: match.ai.winHome / 100,
        win_draw_prob: match.ai.winDraw / 100,
        win_away_prob: match.ai.winAway / 100,
        goal_prob: match.ai.goalNext10 / 100,
        corner_prob: match.ai.cornerOver / 100,
        card_prob: match.ai.cardOver / 100,
        confidence: match.ai.confidence / 100,
      }));

      const insightRows = matches.map((match) => ({
        match_live_id: match.id,
        insight: match.ai.insight,
        suggestion: match.ai.suggestion,
        trend: match.ai.trend,
        pressure_score: match.ai.pressure,
        dominance_score: match.ai.dominance,
        momentum_score: match.ai.momentum,
        value_bet: match.ai.tags.value,
        hot_game: match.ai.tags.hot,
        comeback_signal: match.ai.tags.comeback,
        ideal_moment: match.ai.tags.ideal,
        risk_high: match.ai.tags.highRisk,
        confidence: match.ai.confidence / 100,
        model_mode: match.ai.modelMode,
      }));

      await Promise.all([
        supabase.from("match_predictions").upsert(predictionRows, { onConflict: "match_live_id" }),
        supabase.from("ai_insights").delete().in("match_live_id", matches.map((m) => m.id)),
      ]);

      await supabase.from("ai_insights").insert(insightRows);
    }

    const live = matches.filter((match) => match.status === "live");
    const upcoming = matches.filter((match) => match.status === "upcoming");
    const finished = matches.filter((match) => match.status === "finished");

    return new Response(
      JSON.stringify({
        live,
        upcoming,
        finished,
        sport: selectedSport,
        updatedAt: new Date().toISOString(),
        modelMode,
        source: "betsapi",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const message = stringifyError(error);
    console.error("betsapi-live error:", message, error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
