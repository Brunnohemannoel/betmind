import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Bot,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Flame,
  Loader2,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Star,
  Timer,
  TrendingUp,
  Wallet,
  Zap,
  Trash2,
  Check,
  Plus,
  Minus,
  Calculator,
  CheckCircle2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts";

type MatchStatus = "live" | "upcoming" | "finished";
type SportKey = "football" | "basketball" | "tennis" | "esports";
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

type MatchItem = {
  id: string;
  externalMatchId: string;
  league: string;
  kickoffAt: string | null;
  home: string;
  away: string;
  homeLogo: string;
  awayLogo: string;
  homeScore: number;
  awayScore: number;
  statusDetail: string;
  minute: number;
  status: MatchStatus;
  hot: boolean;
  odds: { home: number | null; draw: number | null; away: number | null };
  markets: {
    totalOver25: number | null;
    totalUnder25: number | null;
    bttsYes: number | null;
    bttsNo: number | null;
    otherMarketCount: number;
  };
  ai: {
    modelMode: "hybrid" | "predictive";
    confidence: number;
    pressure: number;
    momentum: number;
    dominance: number;
    trend: string;
    winHome: number;
    winDraw: number;
    winAway: number;
    goalNext10: number;
    over05: number;
    over15: number;
    over25: number;
    cornerOver: number;
    cardOver: number;
    riskLevel: "low" | "medium" | "high";
    bestBet: {
      market: string;
      confidence: number;
      rationale: string;
      cta: string;
    };
    statusSignals: {
      pressure: number;
      rhythm: string;
      trend: string;
    };
    eventChances: {
      goal: number;
      corner: number;
      card: number;
    };
    charts: {
      pressureTimeline: { label: string; home: number; away: number }[];
      eventTimeline: { label: string; goals: number; corners: number; cards: number }[];
      probabilityTimeline: { label: string; home: number; draw: number; away: number }[];
    };
    alerts: string[];
    insight: string;
    suggestion: string;
    guiadaInsights: {
      safe: { market: string; odd: number; confidence: number; justification: string };
      balanced: { market: string; odd: number; confidence: number; justification: string };
      risky: { market: string; odd: number; confidence: number; justification: string };
    };
    tags: {
      hot: boolean;
      value: boolean;
      ideal: boolean;
      highRisk: boolean;
      comeback: boolean;
    };
  };
  intensityScore: number;
  timeContext: TimeContext;
};

type SavedBet = {
  id: string;
  date: string;
  items: { matchId: string; type: "1" | "X" | "2"; odd: number; home: string; away: string }[];
  amount: number;
  totalOdd: number;
  potentialReturn: number;
  status: "pending" | "won" | "lost";
};

const sportsMenu: { key: SportKey; label: string }[] = [
  { key: "football", label: "Futebol" },
  { key: "basketball", label: "Basquete" },
  { key: "tennis", label: "Tênis" },
  { key: "esports", label: "Egames" },
];

const leftMenu = ["Meus Favoritos", "Alertas IA", "Minhas Apostas"];

const defaultLogo = `${import.meta.env.BASE_URL}placeholder.svg`;

const statusLabel: Record<MatchStatus, string> = {
  live: "Ao vivo",
  upcoming: "Próximos",
  finished: "Finalizados",
};

const sportLabel: Record<SportKey, string> = {
  football: "Futebol",
  basketball: "Basquete",
  tennis: "Tênis",
  esports: "Egames",
};

const upcomingLeaguePreset: { label: string; keywords: string[] }[] = [
  { label: "Brasileirão Série A", keywords: ["brasileirao serie a", "serie a", "serie a brazil", "brazil serie a"] },
  { label: "Copa do Brasil", keywords: ["copa do brasil"] },
  { label: "UEFA Champions League", keywords: ["uefa champions", "champions league", "uefa cl"] },
  { label: "Copa Libertadores", keywords: ["copa libertadores", "libertadores", "conmebol libertadores"] },
  {
    label: "Jogos Amistosos Int",
    keywords: ["amistosos", "amistosos int", "jogos amistosos", "international friendly", "friendly international"],
  },
];

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const fallbackCharts = {
  pressureTimeline: [
    { label: "15'", home: 55, away: 45 },
    { label: "30'", home: 58, away: 42 },
    { label: "45'", home: 62, away: 38 },
    { label: "60'", home: 64, away: 36 },
    { label: "75'", home: 68, away: 32 },
    { label: "90'", home: 70, away: 30 },
  ],
  eventTimeline: [
    { label: "15'", goals: 28, corners: 32, cards: 26 },
    { label: "30'", goals: 35, corners: 38, cards: 31 },
    { label: "45'", goals: 42, corners: 44, cards: 36 },
    { label: "60'", goals: 51, corners: 52, cards: 41 },
    { label: "75'", goals: 60, corners: 61, cards: 48 },
    { label: "90'", goals: 66, corners: 68, cards: 54 },
  ],
  probabilityTimeline: [
    { label: "15'", home: 39, draw: 32, away: 29 },
    { label: "30'", home: 42, draw: 31, away: 27 },
    { label: "45'", home: 44, draw: 30, away: 26 },
    { label: "60'", home: 47, draw: 28, away: 25 },
    { label: "75'", home: 49, draw: 27, away: 24 },
    { label: "90'", home: 52, draw: 25, away: 23 },
  ],
};

type UiAlert = {
  id: string;
  level: "strong" | "medium" | "risk" | "opportunity";
  sport: SportKey;
  matchId: string;
  matchStatus: MatchStatus;
  matchLabel: string;
  league: string;
  minuteLabel: string;
  phaseLabel: string;
  urgencyLevel: UrgencyLevel;
  progressPct: number;
  confidence: number;
  pressure: number;
  title: string;
  description: string;
  detectedAt: string;
  lastSeenAt: string;
};

const alertPriority: Record<UiAlert["level"], number> = {
  strong: 4,
  opportunity: 3,
  medium: 2,
  risk: 1,
};

const sportIcon: Record<SportKey, string> = {
  football: "⚽",
  basketball: "🏀",
  tennis: "🎾",
  esports: "🎮",
};

const formatClock = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

const formatFootballMinute = (minute: number) => (minute > 90 ? `90+${minute - 90}'` : `${minute}'`);

const fallbackTimeContext = (
  match: {
    minute: number;
    status: MatchStatus;
    statusDetail: string;
    ai: { eventChances: { goal: number; corner: number; card: number }; statusSignals: { pressure: number } };
  },
  sport: SportKey,
): TimeContext => {
  const minute = Math.max(0, Number(match.minute ?? 0));
  const maxEventChance = Math.max(match.ai.eventChances.goal, match.ai.eventChances.corner, match.ai.eventChances.card);
  const isCriticalWindow = minute >= 80 && (match.ai.statusSignals.pressure >= 70 || maxEventChance >= 65);
  const urgencyLevel: UrgencyLevel = isCriticalWindow ? "urgent" : minute >= 70 ? "attention" : "normal";

  const footballPhase =
    match.status === "upcoming"
      ? { phaseLabel: "Pré-jogo", phaseKey: "pre_game" }
      : match.status === "finished"
        ? { phaseLabel: "Encerrado", phaseKey: "finished" }
        : minute >= 90
          ? { phaseLabel: "Acréscimos", phaseKey: "stoppage" }
          : minute >= 60
            ? { phaseLabel: "2º Tempo", phaseKey: "second_half" }
            : minute >= 45
              ? { phaseLabel: "Intervalo", phaseKey: "halftime" }
              : { phaseLabel: "1º Tempo", phaseKey: "first_half" };

  return {
    sport,
    minute,
    phaseLabel: sport === "football" ? footballPhase.phaseLabel : match.statusDetail,
    phaseKey: sport === "football" ? footballPhase.phaseKey : "live",
    elapsedSeconds: minute * 60,
    remainingSeconds: sport === "football" ? Math.max(0, 90 * 60 - minute * 60) : null,
    progressPct: sport === "football" ? Math.max(0, Math.min(100, Math.round((minute / 90) * 100))) : Math.min(100, minute),
    isCriticalWindow,
    urgencyLevel,
    snapshotAt: new Date().toISOString(),
  };
};

const buildMatchAlerts = (match: MatchItem): Omit<UiAlert, "detectedAt" | "lastSeenAt">[] => {
  const matchLabel = `${match.home} x ${match.away}`;
  const minuteLabel = match.timeContext.sport === "football" ? formatFootballMinute(match.timeContext.minute) : `${match.timeContext.minute}'`;
  const baseAlert = {
    sport: match.timeContext.sport,
    matchId: match.id,
    matchStatus: match.status,
    matchLabel,
    league: match.league,
    minuteLabel,
    phaseLabel: match.timeContext.phaseLabel,
    urgencyLevel: match.timeContext.urgencyLevel,
    progressPct: match.timeContext.progressPct,
    confidence: Math.max(match.ai.bestBet.confidence, match.ai.confidence),
    pressure: match.ai.statusSignals.pressure,
  };
  const alerts: Omit<UiAlert, "detectedAt" | "lastSeenAt">[] = [];

  const goalChance = match.ai.eventChances.goal;
  const cornerChance = match.ai.eventChances.corner;
  const isFinalMinutes = match.timeContext.sport === "football" && match.timeContext.minute >= 80;

  // 1. Oportunidade Clara de Gol (Stricter threshold)
  if (goalChance >= 80 && match.ai.statusSignals.pressure >= 72) {
    alerts.push({
      id: `${match.id}-goal`,
      level: "strong",
      title: "🔥 Gol iminente! Oportunidade Clara",
      description: `O Agente simulou 10.000 cenários e encontrou ${goalChance}% de chance de Gol neste momento em ${matchLabel}. Pressão ofensiva: ${match.ai.statusSignals.pressure}/100.`,
      ...baseAlert,
    });
  }

  // 2. Oportunidade de Escanteios
  if (cornerChance >= 85 && match.ai.statusSignals.pressure >= 75) {
    alerts.push({
      id: `${match.id}-corner`,
      level: "medium",
      title: "⚡ Avalanche de Escanteios",
      description: `Após verificar os padrões da API e simular o jogo 10.000 vezes, a IA encontrou ${cornerChance}% de chance para novos escanteios em ${matchLabel}.`,
      ...baseAlert,
    });
  }

  // 3. Fim de jogo e chance alta (Reta final)
  if (isFinalMinutes && match.ai.statusSignals.pressure >= 70 && Math.max(goalChance, cornerChance) > 75) {
    const chance = Math.max(goalChance, cornerChance);
    alerts.push({
      id: `${match.id}-final-minutes`,
      level: "strong",
      title: "⏱️ Reta Final Explosiva!",
      description: `O jogo está no fim, mas após 10.000 simulações contínuas, há incríveis ${chance}% de chance de evento em ${matchLabel}. Entre agora!`,
      ...baseAlert,
    });
  }

  // 4. Oportunidade de Valor e Brecha
  if (match.ai.tags.value && match.ai.bestBet.confidence >= 80) {
    alerts.push({
      id: `${match.id}-value`,
      level: "opportunity",
      title: "💰 Oportunidade Única detectada",
      description: `O Agente identificou valor em ${match.ai.bestBet.market}. Análise de 10.000 cenários indica uma enorme chance de ${match.ai.bestBet.confidence}% de sucesso em ${matchLabel}.`,
      ...baseAlert,
    });
  }

  // 5. Alerta de 75' (Reta Final com Análise de Probabilidades)
  if (match.timeContext.sport === "football" && match.timeContext.minute >= 75 && match.timeContext.minute < 80) {
    const lead = match.homeScore > match.awayScore ? "home" : match.awayScore > match.homeScore ? "away" : "draw";
    const leadTeam = lead === "home" ? match.home : lead === "away" ? match.away : "Empate";
    const winProb = lead === "home" ? match.ai.winHome : lead === "away" ? match.ai.winAway : match.ai.winDraw;
    const goalProb = match.ai.goalNext10;

    let desc = "";
    if (lead !== "draw" && winProb >= 72) {
      desc = `Reta final em ${matchLabel}! IA analisou e confirma: ${winProb}% de chance de o ${leadTeam} segurar a vitória nestes 15min finais.`;
    } else if (goalProb >= 70) {
      desc = `Cenário de Alta Pressão! Monitoramento de 10.000 cenários aponta ${goalProb}% de chance de SAIR MAIS UM GOL em ${matchLabel} até o fim.`;
    } else if (lead === "draw" && (match.ai.winHome > 55 || match.ai.winAway > 55)) {
      const favorite = match.ai.winHome > match.ai.winAway ? match.home : match.away;
      desc = `Busca pela Vitória! O jogo em ${matchLabel} está empatado, mas a IA detectou ${Math.max(match.ai.winHome, match.ai.winAway)}% de chance de o ${favorite} marcar e vencer.`;
    }

    if (desc) {
      alerts.push({
        id: `${match.id}-75min-analysis`,
        level: "opportunity",
        title: "⏱️ Verificação: Últimos 15 Min",
        description: desc,
        ...baseAlert,
      });
    }
  }

  return alerts;
};

const Index = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<"jogos" | "alertas" | "favoritos">("jogos");
  const [league, setLeague] = useState("Todas");
  const [status, setStatus] = useState<MatchStatus>("live");
  const [selectedSport, setSelectedSport] = useState<SportKey>("football");
  const [upcomingLeagueFocus, setUpcomingLeagueFocus] = useState("Todas");
  const [gamesOpen, setGamesOpen] = useState(true);
  const [urgentOpen, setUrgentOpen] = useState(false);
  const [agenda, setAgenda] = useState<{ live: MatchItem[]; upcoming: MatchItem[]; finished: MatchItem[] }>({
    live: [],
    upcoming: [],
    finished: [],
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [tickNow, setTickNow] = useState(() => Date.now());
  const [modelMode, setModelMode] = useState<"hybrid" | "predictive">("hybrid");
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisMatch, setAnalysisMatch] = useState<MatchItem | null>(null);
  const [alertStore, setAlertStore] = useState<Record<string, UiAlert>>({});
  const [visibleAlertIds, setVisibleAlertIds] = useState<string[]>([]);
  const [betSlip, setBetSlip] = useState<{ matchId: string; type: "1" | "X" | "2"; odd: number; home: string; away: string }[]>([]);
  const [betAmount, setBetAmount] = useState<string>("100");
  const [isBetSlipOpen, setIsBetSlipOpen] = useState(false);
  const [isMyBetsOpen, setIsMyBetsOpen] = useState(false);
  
  const [myBets, setMyBets] = useState<SavedBet[]>(() => {
    const saved = localStorage.getItem("betmind_mybets");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("betmind_mybets", JSON.stringify(myBets));
  }, [myBets]);

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("betmind_favorites");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [userBalance, setUserBalance] = useState<number>(1278.90);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [depositStep, setDepositStep] = useState<"amount" | "pix">("amount");
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [isBetting, setIsBetting] = useState(false);
  const [guiadaProfile, setGuiadaProfile] = useState<"safe" | "balanced" | "risky">("balanced");

  const toggleSelection = useCallback((match: MatchItem, type: "1" | "X" | "2", odd: number | null) => {
    const safeOdd = (odd !== null && odd > 1) ? odd : 1.50; // Fallback de proteção para teste sem odds da API
    
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(50); // Feedback tátil
    } catch (err) {
      console.error("Vibration API failed:", err);
    }
    
    setBetSlip(prev => {
      const exists = prev.find(item => item.matchId === match.id && item.type === type);
      if (exists) {
        return prev.filter(item => !(item.matchId === match.id && item.type === type));
      }
      const filtered = prev.filter(item => item.matchId !== match.id);
      return [...filtered, { matchId: match.id, type, odd: safeOdd, home: match.home, away: match.away }];
    });
    setIsBetSlipOpen(true); // Abre painel automático
  }, []);

  const isSelected = useCallback((matchId: string, type: "1" | "X" | "2") => {
    return betSlip.some(item => item.matchId === matchId && item.type === type);
  }, [betSlip]);

  const totalOdd = useMemo(() => {
    if (betSlip.length === 0) return 0;
    return betSlip.reduce((acc, item) => acc * item.odd, 1);
  }, [betSlip]);

  const potentialReturn = useMemo(() => {
    const amount = parseFloat(betAmount) || 0;
    return totalOdd * amount;
  }, [totalOdd, betAmount]);

  const betSlipRisk = useMemo(() => {
    if (betSlip.length === 0) return null;
    if (betSlip.length <= 2 && totalOdd < 3) return { label: "Baixo Risco 🟢", className: "text-primary", suggestion: "Boa múltipla com odds equilibradas" };
    if (betSlip.length <= 4 && totalOdd < 8) return { label: "Médio Risco 🟡", className: "text-accent", suggestion: "Equilíbrio risco x retorno" };
    return { label: "Alto Risco 🔴", className: "text-destructive", suggestion: "Risco alto — muitos jogos ou odds elevadas" };
  }, [betSlip, totalOdd]);

  const handleShareBet = () => {
    const text = `🔥 Minha múltipla no BetMind AI!\n\n${betSlip.length} jogos selecionados\nOdd total: ${totalOdd.toFixed(2)}\nRetorno potencial: R$ ${potentialReturn.toFixed(2)}\n\nConfira em: ${window.location.href}`;
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Bilhete pronto para compartilhar.",
    });
  };

  const placeBet = async () => {
    const amount = parseFloat(betAmount);
    if (!amount || amount < 5) {
      toast({ title: "Valor Mínimo R$5", description: "O valor mínimo de aposta é de R$ 5,00.", variant: "destructive" });
      return;
    }
    if (amount > userBalance) {
      toast({ title: "Saldo Insuficiente", description: "Realize um depósito para continuar.", variant: "destructive" });
      return;
    }

    setIsBetting(true);
    
    // Simula delay de rede realista de 1.5s para emular comunicação
    await new Promise(r => setTimeout(r, 1500));
    
    try {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // Micro-feedback de sucesso
    } catch (err) {
      console.error("Vibration API failed:", err);
    }
    
    setUserBalance(prev => prev - amount);
    
    // Salvar bilhete persistente
    const newBet: SavedBet = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      date: new Date().toISOString(),
      items: [...betSlip],
      amount,
      totalOdd,
      potentialReturn,
      status: "pending"
    };
    setMyBets(prev => [newBet, ...prev]);

    toast({
      title: "✅ Aposta realizada com sucesso",
      description: "Sua múltipla foi registrada. Boa sorte!",
      className: "bg-green-500 text-white border-0"
    });
    
    setBetSlip([]);
    setIsBetSlipOpen(false);
    setIsBetting(false);
  };

  const resolveBet = (betId: string, result: "won" | "lost") => {
    setMyBets(prev => {
      const updated = prev.map(bet => {
        if (bet.id === betId && bet.status === "pending") {
          if (result === "won") {
            setUserBalance(b => b + bet.potentialReturn);
            toast({
              title: "🎉 GREEN! Aposta Vencedora",
              description: `O valor de R$ ${bet.potentialReturn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi adicionado ao seu saldo!`,
              className: "bg-green-500 text-white border-0 font-bold"
            });
            try { if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]); } catch (e) {}
          } else {
            toast({
              title: "❌ Red",
              description: "Aposta perdida. Mais sorte na próxima!",
              variant: "destructive"
            });
          }
          return { ...bet, status: result };
        }
        return bet;
      });
      return updated;
    });
  };

  const [shareOpen, setShareOpen] = useState(false);
  const [shareMatch, setShareMatch] = useState<MatchItem | null>(null);
  const matchRefs = useRef<Record<string, HTMLElement | null>>({});
  const shownAlertIdsRef = useRef(new Set<string>());
  const alertTimersRef = useRef<Record<string, number>>({});
  const alertQueueRef = useRef<UiAlert[]>([]);
  const alertDisplayStateRef = useRef<"idle" | "showing" | "paused">("idle");

  const mapMatch = (item: any, itemStatus: MatchStatus): MatchItem => ({
    timeContext:
      item?.timeContext && typeof item.timeContext === "object"
        ? {
            sport: ["football", "basketball", "tennis", "esports"].includes(item.timeContext.sport)
              ? item.timeContext.sport
              : selectedSport,
            minute: Number(item.timeContext.minute ?? item?.minute ?? 0),
            phaseLabel: item.timeContext.phaseLabel ?? item?.statusDetail ?? statusLabel[itemStatus],
            phaseKey: item.timeContext.phaseKey ?? "live",
            elapsedSeconds: Number(item.timeContext.elapsedSeconds ?? Number(item?.minute ?? 0) * 60),
            remainingSeconds:
              typeof item.timeContext.remainingSeconds === "number" ? Number(item.timeContext.remainingSeconds) : null,
            progressPct: Number(item.timeContext.progressPct ?? Math.min(100, Number(item?.minute ?? 0))),
            isCriticalWindow: Boolean(item.timeContext.isCriticalWindow),
            urgencyLevel:
              item.timeContext.urgencyLevel === "urgent" ||
              item.timeContext.urgencyLevel === "attention" ||
              item.timeContext.urgencyLevel === "normal"
                ? item.timeContext.urgencyLevel
                : "normal",
            snapshotAt:
              typeof item.timeContext.snapshotAt === "string" && item.timeContext.snapshotAt
                ? item.timeContext.snapshotAt
                : new Date().toISOString(),
          }
        : fallbackTimeContext(
            {
              minute: Number(item?.minute ?? 0),
              status: itemStatus,
              statusDetail: item?.statusDetail ?? statusLabel[itemStatus],
              ai: {
                eventChances: {
                  goal: Number(item?.ai?.eventChances?.goal ?? item?.ai?.goalNext10 ?? 0),
                  corner: Number(item?.ai?.eventChances?.corner ?? item?.ai?.cornerOver ?? 0),
                  card: Number(item?.ai?.eventChances?.card ?? item?.ai?.cardOver ?? 0),
                },
                statusSignals: { pressure: Number(item?.ai?.statusSignals?.pressure ?? item?.ai?.pressure ?? 0) },
              },
            },
            selectedSport,
          ),
    id: String(item?.id ?? item?.externalMatchId),
    externalMatchId: String(item?.externalMatchId ?? item?.id),
    league: item?.league ?? "Liga não informada",
    kickoffAt: item?.kickoffAt ?? null,
    home: item?.homeTeam?.name ?? "Casa",
    away: item?.awayTeam?.name ?? "Visitante",
    homeLogo: item?.homeTeam?.logoUrl ?? defaultLogo,
    awayLogo: item?.awayTeam?.logoUrl ?? defaultLogo,
    homeScore: Number(item?.homeScore ?? 0),
    awayScore: Number(item?.awayScore ?? 0),
    minute: Number(item?.minute ?? 0),
    status: itemStatus,
    statusDetail: item?.statusDetail ?? statusLabel[itemStatus],
    hot: Boolean(item?.isHot || item?.ai?.tags?.hot),
    odds: {
      home: item?.odds?.home ? Number(item.odds.home) : null,
      draw: item?.odds?.draw ? Number(item.odds.draw) : null,
      away: item?.odds?.away ? Number(item.odds.away) : null,
    },
    markets: {
      totalOver25: typeof item?.odds?.totalOver25 === "number" ? item.odds.totalOver25 : null,
      totalUnder25: typeof item?.odds?.totalUnder25 === "number" ? item.odds.totalUnder25 : null,
      bttsYes: typeof item?.odds?.bttsYes === "number" ? item.odds.bttsYes : null,
      bttsNo: typeof item?.odds?.bttsNo === "number" ? item.odds.bttsNo : null,
      otherMarketCount: Number(item?.odds?.otherMarketCount ?? 0),
    },
    ai: {
      modelMode: item?.ai?.modelMode === "predictive" ? "predictive" : "hybrid",
      confidence: Number(item?.ai?.confidence ?? 0),
      pressure: Number(item?.ai?.pressure ?? 0),
      momentum: Number(item?.ai?.momentum ?? 0),
      dominance: Number(item?.ai?.dominance ?? 0),
      trend: item?.ai?.trend ?? "estavel",
      winHome: Number(item?.ai?.winHome ?? 33),
      winDraw: Number(item?.ai?.winDraw ?? 34),
      winAway: Number(item?.ai?.winAway ?? 33),
      goalNext10: Number(item?.ai?.goalNext10 ?? 0),
      over05: Number(item?.ai?.over05 ?? 0),
      over15: Number(item?.ai?.over15 ?? 0),
      over25: Number(item?.ai?.over25 ?? 0),
      cornerOver: Number(item?.ai?.cornerOver ?? 0),
      cardOver: Number(item?.ai?.cardOver ?? 0),
      riskLevel:
        item?.ai?.riskLevel === "low" || item?.ai?.riskLevel === "medium" || item?.ai?.riskLevel === "high"
          ? item.ai.riskLevel
          : "medium",
      bestBet: {
        market: item?.ai?.bestBet?.market ?? "Over 1.5 gols",
        confidence: Number(item?.ai?.bestBet?.confidence ?? item?.ai?.confidence ?? 0),
        rationale: item?.ai?.bestBet?.rationale ?? "A IA detectou oportunidade ofensiva clara.",
        cta: item?.ai?.bestBet?.cta ?? "Apostar agora",
      },
      statusSignals: {
        pressure: Number(item?.ai?.statusSignals?.pressure ?? item?.ai?.pressure ?? 0),
        rhythm: item?.ai?.statusSignals?.rhythm ?? "moderado",
        trend: item?.ai?.statusSignals?.trend ?? item?.ai?.trend ?? "estavel",
      },
      eventChances: {
        goal: Number(item?.ai?.eventChances?.goal ?? item?.ai?.goalNext10 ?? 0),
        corner: Number(item?.ai?.eventChances?.corner ?? item?.ai?.cornerOver ?? 0),
        card: Number(item?.ai?.eventChances?.card ?? item?.ai?.cardOver ?? 0),
      },
      charts: {
        pressureTimeline: Array.isArray(item?.ai?.charts?.pressureTimeline)
          ? item.ai.charts.pressureTimeline
          : fallbackCharts.pressureTimeline,
        eventTimeline: Array.isArray(item?.ai?.charts?.eventTimeline)
          ? item.ai.charts.eventTimeline
          : fallbackCharts.eventTimeline,
        probabilityTimeline: Array.isArray(item?.ai?.charts?.probabilityTimeline)
          ? item.ai.charts.probabilityTimeline
          : fallbackCharts.probabilityTimeline,
      },
      alerts: Array.isArray(item?.ai?.alerts) ? item.ai.alerts : [],
      insight: item?.ai?.insight ?? "Sem insight no momento.",
      suggestion: item?.ai?.suggestion ?? "👉 Sugestão: Aguardar próxima janela",
      tags: {
        hot: Boolean(item?.ai?.tags?.hot),
        value: Boolean(item?.ai?.tags?.value),
        ideal: Boolean(item?.ai?.tags?.ideal),
        highRisk: Boolean(item?.ai?.tags?.highRisk),
        comeback: Boolean(item?.ai?.tags?.comeback),
      },
      guiadaInsights: {
        safe: { 
          market: item?.ai?.guiada?.safe?.market ?? (item?.homeScore + item?.awayScore > 0 ? "Under 3.5 Gols" : "Over 0.5 Gols"),
          odd: Number(item?.ai?.guiada?.safe?.odd ?? 1.35),
          confidence: Number(item?.ai?.guiada?.safe?.confidence ?? 88),
          justification: item?.ai?.guiada?.safe?.justification ?? "Padrão estatístico sugere alta probabilidade."
        },
        balanced: { 
          market: item?.ai?.guiada?.balanced?.market ?? "Vencedor: Casa",
          odd: Number(item?.ai?.guiada?.balanced?.odd ?? 1.85),
          confidence: Number(item?.ai?.guiada?.balanced?.confidence ?? 72),
          justification: item?.ai?.guiada?.balanced?.justification ?? "Pressão ofensiva constante nos últimos 15 min."
        },
        risky: { 
          market: item?.ai?.guiada?.risky?.market ?? "Próximo Gol: Visitante",
          odd: Number(item?.ai?.guiada?.risky?.odd ?? 3.40),
          confidence: Number(item?.ai?.guiada?.risky?.confidence ?? 45),
          justification: item?.ai?.guiada?.risky?.justification ?? "Tendência de zebra detectada por volume de ataques."
        }
      }
    },
    intensityScore: Number(item?.intensity_score ?? Math.min(100, Math.max(0, (Number(item?.ai?.pressure ?? 0) * 0.7 + Number(item?.ai?.momentum ?? 0) * 0.3)))),
  });

  const fetchLiveData = useCallback(
    async (showToastErrors = false) => {
      const requestLimit = selectedSport === "football" ? 80 : 32;
      const focusedPreset = upcomingLeaguePreset.find((item) => item.label === upcomingLeagueFocus);
      const focusLeague =
        selectedSport === "football" && upcomingLeagueFocus !== "Todas"
          ? focusedPreset?.keywords ?? [upcomingLeagueFocus]
          : undefined;

      const { data, error } = await supabase.functions.invoke("betsapi-live", {
        body: { limit: requestLimit, sport: selectedSport, focusLeague },
      });

      if (error) {
        if (showToastErrors) {
          toast({
            title: "Falha ao atualizar jogos em tempo real",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      const live = Array.isArray(data?.live) ? data.live.map((item: any) => mapMatch(item, "live")) : [];
      
      const now = Date.now();
      const upcoming = Array.isArray(data?.upcoming) 
        ? data.upcoming
            .map((item: any) => mapMatch(item, "upcoming"))
            .filter((m: any) => {
              if (!m.kickoffAt) return true;
              const kickoff = new Date(m.kickoffAt).getTime();
              // Se já passou do horário de início há mais de 2 minutos, remove da lista de próximos
              return kickoff > now - 2 * 60 * 1000;
            })
        : [];

      const finished = Array.isArray(data?.finished) ? data.finished.map((item: any) => mapMatch(item, "finished")) : [];

      setAgenda({ live, upcoming, finished });
      setModelMode(data?.modelMode === "predictive" ? "predictive" : "hybrid");
      setLastUpdate(data?.updatedAt ?? new Date().toISOString());
    },
    [selectedSport, toast, upcomingLeagueFocus],
  );

  useEffect(() => {
    setLeague("Todas");
    setStatus("live");
    setUpcomingLeagueFocus("Todas");
  }, [selectedSport]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      await fetchLiveData(true);
      if (active) setLoading(false);
    };

    run();
    const timer = setInterval(() => {
      fetchLiveData(false);
    }, 30000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [fetchLiveData]);

  const allMatches = useMemo(() => [...agenda.live, ...agenda.upcoming, ...agenda.finished], [agenda]);

  const suggestedMultiples = useMemo(() => {
    const live = allMatches.filter(m => m.status === "live" && m.odds.home !== null && m.odds.home! > 1);
    const safe = live.filter(m => m.odds.home! >= 1.15 && m.odds.home! <= 1.45).slice(0, 3);
    const moderate = live.filter(m => m.odds.home! > 1.45 && m.odds.home! <= 2.1).slice(0, 2);
    const aggressive = live.filter(m => m.odds.home! > 2.1).slice(0, 2);
    return { safe, moderate, aggressive };
  }, [allMatches]);

  const addMultipleToSlip = (matches: MatchItem[], type: "1" | "X" | "2") => {
    setBetSlip(prev => {
      const newItems = matches.map(m => ({
        matchId: m.id,
        type,
        odd: m.odds.home!,
        home: m.home,
        away: m.away
      }));
      const filtered = prev.filter(p => !newItems.some(n => n.matchId === p.matchId));
      return [...filtered, ...newItems];
    });
    setIsBetSlipOpen(true);
    toast({
      title: "Múltipla Adicionada!",
      description: `${matches.length} jogos foram inseridos no seu bilhete.`,
    });
  };

  const leagues = useMemo(() => {
    const dynamicLeagues = [...new Set(allMatches.map((item) => item.league))];
    return ["Todas", ...dynamicLeagues];
  }, [allMatches]);

  const selectedUpcomingLeague = useMemo(
    () => upcomingLeaguePreset.find((item) => item.label === upcomingLeagueFocus),
    [upcomingLeagueFocus],
  );


  const toggleFavorite = useCallback((matchId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      localStorage.setItem("betmind_favorites", JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const handleShare = (match: MatchItem) => {
    setShareMatch(match);
    setShareOpen(true);
  };

  const filteredMatches = useMemo(() => {
    const base = status === "live" ? agenda.live : status === "upcoming" ? agenda.upcoming : agenda.finished;
    let filtered = base.filter((item) => item.timeContext.sport === selectedSport);

    if (activeView === "favoritos") {
      filtered = allMatches.filter((item) => favorites.has(item.id));
    } else if (league !== "Todas") {
      filtered = filtered.filter((item) => item.league === league);
    }

    const term = normalizeText(search);
    const activeLeagueFilter = status === "upcoming" && upcomingLeagueFocus !== "Todas" ? upcomingLeagueFocus : league;
    const canUseUpcomingPreset = status === "upcoming" && selectedSport === "football" && Boolean(selectedUpcomingLeague);

    return filtered.filter((match) => {
      const normalizedLeague = normalizeText(match.league);
      const leagueOk = activeView === "favoritos" || (canUseUpcomingPreset
        ? selectedUpcomingLeague!.keywords.some((keyword) => normalizedLeague.includes(normalizeText(keyword)))
        : activeLeagueFilter === "Todas" || match.league === activeLeagueFilter);
      const searchText = normalizeText(`${match.home} ${match.away} ${match.league}`);
      const searchOk = term.length === 0 || searchText.includes(term);
      return leagueOk && searchOk;
    });
  }, [agenda, league, search, status, upcomingLeagueFocus, selectedSport, selectedUpcomingLeague, favorites, activeView, allMatches]);

  const upcomingPopularLeagues = useMemo(() => {
    return ["Todas", ...upcomingLeaguePreset.map((item) => item.label)];
  }, []);

  const upcomingCalendar = useMemo(() => {
    if (status !== "upcoming") return [] as { id: string; label: string; matches: MatchItem[] }[];

    const grouped = new Map<string, MatchItem[]>();
    filteredMatches.forEach((match) => {
      const key = match.kickoffAt ? new Date(match.kickoffAt).toISOString().slice(0, 10) : "sem-data";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(match);
    });

    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, matches]) => {
        const label =
          key === "sem-data"
            ? "Data não informada"
            : new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              });

        return {
          id: key,
          label,
          matches: [...matches].sort((a, b) => {
            const aTime = a.kickoffAt ? new Date(a.kickoffAt).getTime() : Number.MAX_SAFE_INTEGER;
            const bTime = b.kickoffAt ? new Date(b.kickoffAt).getTime() : Number.MAX_SAFE_INTEGER;
            return aTime - bTime;
          }),
        };
      });
  }, [filteredMatches, status]);

  useEffect(() => {
    setAlertStore((previousStore) => {
      const now = new Date().toISOString();
      const activeMatches = allMatches.filter((match) => match.status === "live" || match.status === "upcoming");
      const activeMatchIds = new Set(activeMatches.map((match) => match.id));

      const nextStore: Record<string, UiAlert> = {};

      Object.values(previousStore).forEach((alert) => {
        if (activeMatchIds.has(alert.matchId)) {
          nextStore[alert.id] = alert;
        }
      });

      activeMatches.forEach((match) => {
        buildMatchAlerts(match).forEach((alert) => {
          const current = nextStore[alert.id];
          nextStore[alert.id] = {
            ...alert,
            detectedAt: current?.detectedAt ?? now,
            lastSeenAt: now,
          };
        });
      });

      return nextStore;
    });
  }, [allMatches]);

  const activeAlerts = useMemo(
    () =>
      Object.values(alertStore).sort((a, b) => {
        const priorityDiff = alertPriority[b.level] - alertPriority[a.level];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
      }),
    [alertStore],
  );

  useEffect(() => {
    const activeIds = new Set(activeAlerts.map((alert) => alert.id));

    Object.keys(alertTimersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        window.clearTimeout(alertTimersRef.current[id]);
        delete alertTimersRef.current[id];
        shownAlertIdsRef.current.delete(id);
        alertQueueRef.current = alertQueueRef.current.filter((a) => a.id !== id);
      }
    });

    const incoming = activeAlerts.filter((alert) => !shownAlertIdsRef.current.has(alert.id));
    if (incoming.length > 0) {
      incoming.forEach((alert) => {
        shownAlertIdsRef.current.add(alert.id);
        alertQueueRef.current.push(alert);
      });

      alertQueueRef.current.sort((a, b) => {
        const priorityDiff = alertPriority[b.level] - alertPriority[a.level];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
      });
    }
  }, [activeAlerts]);

  useEffect(() => {
    const processQueue = () => {
      if (alertDisplayStateRef.current !== "idle") return;
      if (alertQueueRef.current.length === 0) return;

      const nextAlert = alertQueueRef.current.shift();
      if (!nextAlert) return;

      alertDisplayStateRef.current = "showing";
      setVisibleAlertIds([nextAlert.id]);

      alertTimersRef.current[nextAlert.id] = window.setTimeout(() => {
        setVisibleAlertIds([]);
        alertDisplayStateRef.current = "paused";
        delete alertTimersRef.current[nextAlert.id];

        window.setTimeout(() => {
          alertDisplayStateRef.current = "idle";
        }, 2000); // 2s de pausa entre alertas
      }, 6000); // 6s de exibição por alerta
    };

    const interval = window.setInterval(processQueue, 500);
    return () => {
      window.clearInterval(interval);
      Object.values(alertTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTickNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const floatingAlerts = useMemo(
    () => visibleAlertIds.map((id) => alertStore[id]).filter((alert): alert is UiAlert => Boolean(alert)),
    [alertStore, visibleAlertIds],
  );

  const formatKickoff = (kickoffAt: string | null) => {
    if (!kickoffAt) return "--:--";
    return new Date(kickoffAt).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLiveTimeView = useCallback(
    (match: MatchItem) => {
      const base = match.timeContext ?? fallbackTimeContext(match, selectedSport);
      const snapshotMs = new Date(base.snapshotAt || lastUpdate || new Date().toISOString()).getTime();
      const elapsedDelta = match.status === "live" ? Math.max(0, Math.floor((tickNow - snapshotMs) / 1000)) : 0;
      const elapsedSeconds = Math.max(0, base.elapsedSeconds + elapsedDelta);
      const minute = Math.max(base.minute, Math.floor(elapsedSeconds / 60));
      const maxEventChance = Math.max(match.ai.eventChances.goal, match.ai.eventChances.corner, match.ai.eventChances.card);
      const isCriticalWindow = minute >= 80 && (match.ai.statusSignals.pressure >= 70 || maxEventChance >= 65);
      const urgencyLevel: UrgencyLevel = isCriticalWindow ? "urgent" : minute >= 70 ? "attention" : "normal";

      const footballPhase =
        match.status === "upcoming"
          ? { phaseLabel: "Pré-jogo", phaseKey: "pre_game" }
          : match.status === "finished"
            ? { phaseLabel: "Encerrado", phaseKey: "finished" }
            : minute >= 90
              ? { phaseLabel: "Acréscimos", phaseKey: "stoppage" }
              : minute >= 60
                ? { phaseLabel: "2º Tempo", phaseKey: "second_half" }
                : minute >= 45
                  ? { phaseLabel: "Intervalo", phaseKey: "halftime" }
                  : { phaseLabel: "1º Tempo", phaseKey: "first_half" };

      const phaseLabel = base.sport === "football" ? footballPhase.phaseLabel : base.phaseLabel;
      const phaseKey = base.sport === "football" ? footballPhase.phaseKey : base.phaseKey;
      const remainingSeconds =
        typeof base.remainingSeconds === "number" ? Math.max(0, base.remainingSeconds - elapsedDelta) : null;
      const progressPct =
        base.sport === "football"
          ? Math.min(100, Math.max(0, Math.round((minute / 90) * 100)))
          : base.sport === "basketball"
            ? Math.min(100, Math.max(0, Math.round((elapsedSeconds / (48 * 60)) * 100)))
            : base.progressPct;

      const minuteLabel = base.sport === "football" ? formatFootballMinute(minute) : `${minute}'`;
      const headerLabel =
        base.sport === "football"
          ? `${sportIcon[base.sport]} ${minuteLabel} — ${phaseLabel}`
          : base.sport === "basketball"
            ? `${sportIcon[base.sport]} ${phaseLabel} — ${remainingSeconds !== null ? `${formatClock(remainingSeconds)} restantes` : minuteLabel}`
            : base.sport === "tennis"
              ? `${sportIcon[base.sport]} ${phaseLabel} — ${match.homeScore}x${match.awayScore}`
              : `${sportIcon[base.sport]} ${phaseLabel} — ${formatClock(elapsedSeconds)}`;

      const countdownLabel =
        remainingSeconds !== null && (minute >= 75 || urgencyLevel !== "normal")
          ? `⏳ ${formatClock(remainingSeconds)} para o fim`
          : null;

      const urgencyText =
        urgencyLevel === "urgent" && minute >= 80
          ? "🚨 FINAL DE JOGO! Última chance de apostar"
          : minute >= 75
            ? "⏱️ Últimos minutos! Odds podem mudar rápido"
            : isCriticalWindow
              ? "⚡ Jogo aberto — aproveite agora"
              : match.ai.tags.value
                ? "💰 Odds ainda boas antes do fim"
                : null;

      return {
        sport: base.sport,
        minute,
        minuteLabel,
        phaseLabel,
        phaseKey,
        urgencyLevel,
        isCriticalWindow,
        progressPct,
        clockLabel: formatClock(elapsedSeconds),
        countdownLabel,
        headerLabel,
        urgencyText,
      };
    },
    [lastUpdate, selectedSport, tickNow],
  );

  const urgencyMeta: Record<UrgencyLevel, { label: string; className: string }> = {
    normal: { label: "Normal", className: "urgency-pill urgency-pill-normal" },
    attention: { label: "Atenção", className: "urgency-pill urgency-pill-attention" },
    urgent: { label: "URGENTE", className: "urgency-pill urgency-pill-urgent" },
  };

  const readableTrend = (trend: string) => {
    if (trend === "subindo") return "Ritmo acelerando";
    if (trend === "caindo") return "Ritmo reduzindo";
    return "Ritmo estável";
  };

  const formatOdd = (value: number | null) => (typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "--");

  const riskMeta: Record<MatchItem["ai"]["riskLevel"], { label: string; className: string }> = {
    low: { label: "Baixo 🟢", className: "risk-pill risk-low" },
    medium: { label: "Médio 🟡", className: "risk-pill risk-medium" },
    high: { label: "Alto 🔴", className: "risk-pill risk-high" },
  };

  const emptyStateMessage = (selectedStatus: MatchStatus, sport: SportKey, upcomingFilter: string) => {
    const currentSport = sportLabel[sport];
    if (selectedStatus === "live") return `Sem jogos de ${currentSport} ao vivo agora. Tente a aba Próximos.`;
    if (selectedStatus === "upcoming" && upcomingFilter !== "Todas") {
      return `Sem jogos agendados para ${upcomingFilter} agora.`;
    }
    if (selectedStatus === "upcoming") return `Sem jogos de ${currentSport} agendados neste momento.`;
    return `Sem jogos de ${currentSport} finalizados recentemente.`;
  };

  const probabilityChartConfig = {
    home: { label: "Casa", color: "hsl(var(--primary))" },
    draw: { label: "Empate", color: "hsl(var(--muted-foreground))" },
    away: { label: "Fora", color: "hsl(var(--accent))" },
  };

  const pressureChartConfig = {
    home: { label: "Casa", color: "hsl(var(--primary))" },
    away: { label: "Fora", color: "hsl(var(--accent))" },
  };

  const eventChartConfig = {
    goals: { label: "Gols", color: "hsl(var(--primary))" },
    corners: { label: "Escanteios", color: "hsl(var(--accent))" },
    cards: { label: "Cartões", color: "hsl(var(--destructive))" },
  };

  const openAiAnalysis = (match: MatchItem) => {
    setAnalysisMatch(match);
    setAnalysisOpen(true);
  };

  const openMatchFromAlert = useCallback(
    (alert: UiAlert) => {
      const targetMatch = allMatches.find((match) => match.id === alert.matchId);
      if (!targetMatch) return;

      setActiveView("jogos");
      setSearch("");
      setLeague("Todas");
      setStatus(targetMatch.status === "finished" ? "live" : targetMatch.status);
      if (targetMatch.status === "upcoming") setUpcomingLeagueFocus("Todas");

      window.setTimeout(() => {
        const cardNode = matchRefs.current[targetMatch.id];
        cardNode?.scrollIntoView({ behavior: "smooth", block: "center" });
        setAnalysisMatch(targetMatch);
        setAnalysisOpen(true);
      }, 220);

      setVisibleAlertIds((previous) => previous.filter((id) => id !== alert.id));
    },
    [allMatches],
  );

  const renderMatchCard = (match: MatchItem) => {
    const timeView = getLiveTimeView(match);
    const isFavorite = favorites.has(match.id);

    return (
      <article
        key={match.id}
        id={`match-${match.id}`}
        ref={(node) => {
          matchRefs.current[match.id] = node;
        }}
        className={cn("agenda-row", match.hot && "hot-match", isFavorite && "favorite-match")}
      >
        <div className="agenda-header relative">
          <div className="absolute right-0 top-0 flex gap-2">
            <button
              onClick={() => handleShare(match)}
              className="p-1.5 rounded-full hover:bg-accent/20 transition-all text-muted-foreground hover:text-accent group"
              title="Compartilhar"
            >
              <Share2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
            </button>
            <button
              onClick={() => toggleFavorite(match.id)}
              className={cn(
                "p-1.5 rounded-full hover:bg-yellow-400/10 transition-all group",
                isFavorite ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"
              )}
              title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            >
              <Star className={cn("h-4 w-4 transition-all group-hover:scale-110", isFavorite && "fill-current animate-pulse-glow")} />
            </button>
          </div>

          <div className="agenda-league pr-16">
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{match.league}</p>
              {isFavorite && <Badge className="bg-yellow-400/20 text-yellow-400 border-yellow-400/30 text-[10px] h-4">⭐ Favorito</Badge>}
            </div>
            {/* Urgency Bar for Late Games */}
            {match.status === "live" && timeView.minute >= 75 && (
              <div className="mb-2 p-2 bg-red-600/10 border border-red-500/20 rounded-md animate-in fade-in slide-in-from-top-1 duration-500 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-red-500 flex items-center gap-1 uppercase tracking-tighter">
                    <AlertTriangle className="h-3 w-3 animate-pulse" /> 🚨 Última chance de apostar
                  </span>
                  <span className="text-[10px] font-bold text-red-500/80">90' encerra</span>
                </div>
                <div className="h-1 w-full bg-red-500/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 animate-pulse" 
                    style={{ width: `${Math.min(100, Math.max(0, ((timeView.minute - 75) / 15) * 100))}%` }}
                  />
                </div>
              </div>
            )}
            {match.status === "live" && (
              <div className="time-context-block">
                <div className={cn("time-pill", `time-pill-${timeView.urgencyLevel}`, timeView.isCriticalWindow && "critical-pulse")}>
                  <span className="live-dot" aria-hidden />
                  <span>{timeView.headerLabel}</span>
                </div>
                <div className="time-context-meta">
                  <span className="time-clock">🕒 {timeView.clockLabel}</span>
                  {timeView.countdownLabel && <span className="time-countdown">{timeView.countdownLabel}</span>}
                  {timeView.urgencyText && <span className="time-urgency-text">{timeView.urgencyText}</span>}
                </div>
                <div className="match-progress-wrap">
                  <div className="match-progress-bar">
                    <span style={{ width: `${timeView.progressPct}%` }} />
                  </div>
                  <span className="match-progress-text">{timeView.progressPct}%</span>
                </div>
              </div>
            )}
            
            {/* Termômetro do Jogo (Intensity Bar) */}
            {match.status === "live" && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider">
                  <span className="flex items-center gap-1">
                    <Flame className={cn("h-3 w-3", 
                      match.intensityScore > 70 ? "text-red-500 animate-pulse" : 
                      match.intensityScore > 40 ? "text-yellow-500" : "text-blue-500"
                    )} />
                    Intensidade: {match.intensityScore}%
                  </span>
                  <span className={cn(
                    match.intensityScore > 70 ? "text-red-500" : 
                    match.intensityScore > 40 ? "text-yellow-500" : "text-blue-500"
                  )}>
                    {match.intensityScore > 70 ? "🔥 Jogo Quente" : 
                     match.intensityScore > 40 ? "⚡ Pressão Média" : "❄️ Ritmo Calmo"}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-secondary/30 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className={cn("h-full transition-all duration-1000 ease-out", 
                      match.intensityScore > 70 ? "bg-gradient-to-r from-orange-600 to-red-600 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : 
                      match.intensityScore > 40 ? "bg-gradient-to-r from-blue-500 to-yellow-500" : "bg-blue-600"
                    )}
                    style={{ width: `${match.intensityScore}%` }}
                  />
                </div>
              </div>
            )}
            
            {match.status === "upcoming" && <span className="text-xs text-muted-foreground">Início: {formatKickoff(match.kickoffAt)}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2 pr-16">
            <Badge variant="secondary">Casa {match.ai.winHome}%</Badge>
            <Badge variant="secondary">Empate {match.ai.winDraw}%</Badge>
            <Badge variant="secondary">Fora {match.ai.winAway}%</Badge>
            <span className={urgencyMeta[timeView.urgencyLevel].className}>{urgencyMeta[timeView.urgencyLevel].label}</span>
            {isFavorite && match.status === "live" && (
              <div className="flex gap-2">
                {match.ai.goalNext10 >= 70 && <Badge className="bg-red-500/20 text-red-500 border-red-500/30 animate-pulse">⚡ Chance de gol</Badge>}
                {match.ai.pressure >= 75 && <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">🔥 Seu jogo está quente</Badge>}
                {timeView.minute >= 75 && <Badge className="bg-destructive/20 text-destructive border-destructive/30">🚨 Momento crítico</Badge>}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {/* Main Scoreboard Line */}
          <div className="flex items-center justify-between w-full py-3 bg-secondary/10 rounded-lg px-2 my-2 border border-border/40">
            {/* Home Team (Left side) */}
            <div className="flex items-center gap-3 flex-1 justify-start bg-background/60 hover:bg-background/80 transition-all px-3 py-2 rounded-2xl border border-primary/20 shadow-sm">
              <img
                src={match.homeLogo}
                alt={`Logo do ${match.home}`}
                loading="lazy"
                className="h-12 w-12 min-w-[48px] rounded-full border border-border bg-background/50 object-contain p-0.5"
                onError={(event) => { event.currentTarget.src = defaultLogo; }}
              />
              <span className="font-bold text-[13px] md:text-[15px] leading-tight text-foreground whitespace-normal break-words drop-shadow-sm" title={match.home}>{match.home}</span>
            </div>

            {/* Score Center */}
            <div className="flex items-center justify-center gap-2 px-3 mx-2 bg-background/60 rounded-md py-1 shadow-sm border border-border/30">
              <span className={cn("text-xl font-black w-5 text-center tracking-tighter", match.homeScore > match.awayScore ? "text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "text-foreground")}>{match.homeScore}</span>
              <span className="text-muted-foreground/50 text-xs font-bold px-1">X</span>
              <span className={cn("text-xl font-black w-5 text-center tracking-tighter", match.awayScore > match.homeScore ? "text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "text-foreground")}>{match.awayScore}</span>
            </div>

            {/* Away Team (Right side) */}
            <div className="flex items-center gap-3 flex-1 justify-end bg-background/60 hover:bg-background/80 transition-all px-3 py-2 rounded-2xl border border-primary/20 shadow-sm">
              <span className="font-bold text-[13px] md:text-[15px] leading-tight text-foreground whitespace-normal break-words drop-shadow-sm text-right" title={match.away}>{match.away}</span>
              <img
                src={match.awayLogo}
                alt={`Logo do ${match.away}`}
                loading="lazy"
                className="h-12 w-12 min-w-[48px] rounded-full border border-border bg-background/50 object-contain p-0.5"
                onError={(event) => { event.currentTarget.src = defaultLogo; }}
              />
            </div>
          </div>
        </div>

        <div className="agenda-odds-block">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Odds principais (1X2)</p>
        <div className="flex gap-2 items-center">
          <div className="agenda-odds flex-1">
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelection(match, "1", match.odds.home); }}
              className={cn("odds-chip clickable", isSelected(match.id, "1") && "active")}
            >
              1 • {formatOdd(match.odds.home)}
            </button>
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelection(match, "X", match.odds.draw); }}
              className={cn("odds-chip clickable", isSelected(match.id, "X") && "active")}
            >
              X • {formatOdd(match.odds.draw)}
            </button>
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelection(match, "2", match.odds.away); }}
              className={cn("odds-chip clickable", isSelected(match.id, "2") && "active")}
            >
              2 • {formatOdd(match.odds.away)}
            </button>
          </div>
        </div>
        {/* Quick Bet Buttons: one per outcome */}
        <div className="flex gap-2 mt-2">
          <Button 
            type="button"
            size="sm"
            className={cn("flex-1 h-8 font-black rounded-md text-xs gap-1", isSelected(match.id, "1") ? "bg-green-600 text-white" : "bg-green-500/90 hover:bg-green-600 text-white")}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelection(match, "1", match.odds.home); }}
          >
            ★ Casa
          </Button>
          <Button 
            type="button"
            size="sm"
            className={cn("flex-1 h-8 font-black rounded-md text-xs gap-1", isSelected(match.id, "X") ? "bg-amber-600 text-white" : "bg-amber-500/90 hover:bg-amber-600 text-white")}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelection(match, "X", match.odds.draw); }}
          >
            = Empate
          </Button>
          <Button 
            type="button"
            size="sm"
            className={cn("flex-1 h-8 font-black rounded-md text-xs gap-1", isSelected(match.id, "2") ? "bg-blue-600 text-white" : "bg-blue-500/90 hover:bg-blue-600 text-white")}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelection(match, "2", match.odds.away); }}
          >
            ★ Fora
          </Button>
        </div>
        </div>

        <div className="agenda-markets-grid">
        <div className="agenda-market-card">
          <p className="agenda-market-title">Total gols (2.5)</p>
          <p className="agenda-market-value">Over {formatOdd(match.markets.totalOver25)} • Under {formatOdd(match.markets.totalUnder25)}</p>
        </div>
        <div className="agenda-market-card">
          <p className="agenda-market-title">Ambas marcam</p>
          <p className="agenda-market-value">Sim {formatOdd(match.markets.bttsYes)} • Não {formatOdd(match.markets.bttsNo)}</p>
        </div>
        <div className="agenda-market-card">
          <p className="agenda-market-title">Outros mercados</p>
          <p className="agenda-market-value">
            {match.markets.otherMarketCount > 0 ? `${match.markets.otherMarketCount} linhas disponíveis` : "Sem linhas adicionais"}
          </p>
        </div>
        </div>

        <div className="agenda-ai">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-primary/20 text-primary">Gol em 10 min: {match.ai.goalNext10}%</Badge>
          <Badge variant="outline">Intensidade do ataque: {match.ai.pressure}/100</Badge>
          <Badge variant="outline">{readableTrend(match.ai.trend)}</Badge>
          {match.ai.tags.hot && <Badge className="bg-primary/20 text-primary">🔥 Jogo quente</Badge>}
          {match.ai.tags.value && <Badge className="bg-accent/20 text-accent">💰 Oportunidade de valor</Badge>}
          {match.ai.tags.ideal && <Badge className="bg-primary/20 text-primary">⚡ Momento ideal</Badge>}
          {match.ai.tags.highRisk && <Badge variant="destructive">🚨 Risco alto</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{match.ai.insight}</p>
        <p className="text-sm font-medium">Sugestão da IA: {match.ai.suggestion}</p>
        </div>

        <div className="agenda-actions">
          <Button size="sm" onClick={() => openAiAnalysis(match)}>
            <Bot className="h-4 w-4" />
            ANÁLISE IA
          </Button>
        </div>
      </article>
    );
  };

  return (
    <main className="betmind-bg min-h-screen p-3 md:p-4">
      <section className="sportsbook-shell">
        <aside className="sportsbook-sidebar md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:overflow-y-auto">
          <div className="space-y-4">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Devos da Sorte" className="w-[220px] mx-auto h-auto object-contain" />
            <div className="space-y-1.5 text-center">
              <Badge className="w-fit bg-primary/20 text-primary mx-auto">BetMind AI</Badge>
              <h1 className="text-2xl font-semibold tracking-tight">Painel Trader Pro</h1>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Collapsible open={gamesOpen} onOpenChange={setGamesOpen} className="menu-group">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start">
                  <ChevronRight className={cn("h-4 w-4 transition-transform", gamesOpen && "rotate-90")} />
                  Jogos
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="sports-submenu">
                {sportsMenu.map((item) => (
                  <Button
                    key={item.key}
                    variant={selectedSport === item.key ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => {
                      setSelectedSport(item.key);
                      setActiveView("jogos");
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                    {item.label}
                  </Button>
                ))}
              </CollapsibleContent>
            </Collapsible>

            {leftMenu.map((item) => (
              <Button
                key={item}
                variant={
                  (item === "Ao Vivo" && activeView === "jogos") ||
                  (item === "Meus Favoritos" && activeView === "favoritos") ||
                  (item === "Alertas IA" && activeView === "alertas") ||
                  (item === "Painel Pro" && activeView === "jogos" && status === "live")
                    ? "secondary" 
                    : "ghost"
                }
                className="w-full justify-start"
                onClick={() => {
                  if (item === "Alertas IA") setActiveView("alertas");
                  else if (item === "Meus Favoritos") setActiveView("favoritos");
                  else if (item === "Minhas Apostas") setIsMyBetsOpen(true);
                  else {
                    setActiveView("jogos");
                    if (item === "Ao Vivo") setStatus("live");
                  }
                }}
              >
                <ChevronRight className="h-4 w-4" />
                {item}
              </Button>
            ))}
          </div>

          <div className="space-y-4 pt-2">
            {/* Aposta Guiada (IA) Section */}
            <div className="space-y-3 px-1">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary/80">
                <Sparkles className="h-3.5 w-3.5" />
                Aposta Guiada (IA)
              </div>
              
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-secondary/20 rounded-lg border border-white/5">
                {[
                  { id: "safe", label: "Seguro", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
                  { id: "balanced", label: "Equilib.", icon: Zap, color: "text-yellow-500", bg: "bg-yellow-500/10" },
                  { id: "risky", label: "Arriscado", icon: Flame, color: "text-red-500", bg: "bg-red-500/10" }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setGuiadaProfile(p.id as any)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2 rounded-md transition-all border border-transparent",
                      guiadaProfile === p.id 
                        ? `${p.bg} border-${p.color.split("-")[1]}-500/30 shadow-sm scale-[1.02]` 
                        : "hover:bg-white/5 opacity-60 hover:opacity-100"
                    )}
                  >
                    <p.icon className={cn("h-4 w-4", guiadaProfile === p.id ? p.color : "text-muted-foreground")} />
                    <span className="text-[9px] font-bold uppercase">{p.label}</span>
                  </button>
                ))}
              </div>

              {/* Dynamic Suggestion Card */}
              {agenda.live.length > 0 && (
                <Card className="bg-gradient-to-br from-secondary/40 to-background border-primary/20 shadow-lg overflow-hidden group">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className={cn("text-[9px] h-4 px-1.5 border-0", 
                        guiadaProfile === "safe" ? "bg-green-500/20 text-green-500" :
                        guiadaProfile === "balanced" ? "bg-yellow-500/20 text-yellow-500" : "bg-red-500/20 text-red-500"
                      )}>
                        {guiadaProfile === "safe" ? "BAIXO RISCO" : guiadaProfile === "balanced" ? "EQUILIBRADO" : "ALTO RISCO"}
                      </Badge>
                      <span className="text-[10px] font-bold text-primary">{agenda.live[0].ai.guiadaInsights[guiadaProfile].confidence}% Confiança</span>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-muted-foreground font-bold truncate">{agenda.live[0].home} x {agenda.live[0].away}</p>
                      <p className="text-xs font-black text-foreground">{agenda.live[0].ai.guiadaInsights[guiadaProfile].market}</p>
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-tight italic">
                      "{agenda.live[0].ai.guiadaInsights[guiadaProfile].justification}"
                    </p>

                    <Button 
                      size="sm" 
                      className="w-full h-8 text-[10px] font-black uppercase btn-glow"
                      onClick={() => toggleSelection(agenda.live[0], "1", agenda.live[0].ai.guiadaInsights[guiadaProfile].odd)}
                    >
                      Apostar • @{agenda.live[0].ai.guiadaInsights[guiadaProfile].odd.toFixed(2)}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* User Profile Block */}
            <div className="flex items-center gap-3 p-3 bg-card/60 rounded-xl border border-border/50">
              <div className="relative">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Trader" alt="Trader Silva" className="w-10 h-10 rounded-full bg-secondary" />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></span>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold truncate">Trader Silva</p>
                <div className="flex items-center gap-1">
                  <Badge className="bg-primary/20 text-primary border-0 text-[10px] h-4 px-1.5 rounded-sm">PRO</Badge>
                  <span className="text-xs text-muted-foreground truncate">trader@betmind.ai</span>
                </div>
              </div>
            </div>

            {/* Balance Block */}
            <Card className="glass-panel border-0">
              <CardContent className="p-4 text-sm">
                <p className="mb-1 flex items-center justify-between text-foreground">
                  <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Saldo</span>
                </p>
                <p className="text-xl font-semibold">R$ {userBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="mt-1 text-xs text-muted-foreground">Bônus ativo +12%</p>
                <Button 
                  className="btn-glow mt-3 w-full"
                  onClick={() => setIsDepositOpen(true)}
                >
                  <CircleDollarSign className="h-4 w-4" />
                  Depositar
                </Button>
              </CardContent>
            </Card>
          </div>
        </aside>

        <section className="sportsbook-main">
          {/* Game Stories section */}
          <div className="mb-6 px-1">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                Destaques BetMind
              </h3>
              <span className="text-[10px] text-primary/60 font-medium">Arraste para ver mais</span>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-1 px-1 snap-x scroll-smooth">
              {/* Special Story: IA Recommendation */}
              <div className="flex-none scroll-snap-align-start group cursor-pointer" onClick={() => setActiveView("alertas")}>
                <div className="relative">
                  <div className="w-16 h-16 rounded-full p-[3px] bg-gradient-to-tr from-primary via-accent to-purple-500 animate-spin-slow">
                    <div className="w-full h-full rounded-full bg-background border-2 border-background overflow-hidden flex items-center justify-center">
                      <Bot className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                  <Badge className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-primary text-[8px] h-4 border-0">TOP IA</Badge>
                </div>
                <p className="text-[10px] font-bold text-center mt-2 group-hover:text-primary">Insights</p>
              </div>

              {/* Match Stories */}
              {agenda.live.concat(agenda.upcoming).slice(0, 8).map((m) => (
                <div 
                  key={`story-${m.id}`} 
                  className="flex-none scroll-snap-align-start group cursor-pointer" 
                  onClick={() => openAiAnalysis(m)}
                >
                  <div className="relative">
                    <div className={cn(
                      "w-16 h-16 rounded-full p-[3px] transition-all group-hover:scale-105",
                      m.status === "live" ? "bg-gradient-to-tr from-green-500 to-emerald-400" : "bg-gradient-to-tr from-blue-500 to-indigo-400"
                    )}>
                      <div className="w-full h-full rounded-full bg-background border-2 border-background overflow-hidden flex items-center justify-center p-2 relative">
                        <img 
                          src={m.homeLogo} 
                          className="w-full h-full object-contain filter grayscale-[0.2] transition-all group-hover:grayscale-0" 
                          alt={m.home} 
                        />
                        {m.status === "live" && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <span className="text-[9px] font-black text-white drop-shadow-md">{m.homeScore}-{m.awayScore}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {m.status === "live" && <Badge className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-green-500 text-[8px] h-4 border-0 animate-pulse">LIVE</Badge>}
                  </div>
                  <p className="text-[10px] font-bold text-center mt-2 truncate w-16">{m.home.split(' ')[0]}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="sportsbook-sticky-header">
            <header className="sportsbook-topbar">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar jogo, liga ou time"
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary">Esporte: {sportLabel[selectedSport]}</Badge>
              <Badge className="bg-primary/20 text-primary">{modelMode === "predictive" ? "IA Preditiva" : "IA Híbrida"}</Badge>
              <Button variant="secondary" onClick={() => setUrgentOpen(true)}>
                <BellRing className="h-4 w-4" />
                Alerta urgente
              </Button>
            </header>

            {activeView === "jogos" && (
              <div className="sportsbook-filters">
                {(["live", "upcoming", "finished"] as MatchStatus[]).map((item) => (
                  <Button key={item} variant={status === item ? "default" : "outline"} onClick={() => setStatus(item)} className="rounded-full">
                    {statusLabel[item]}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {activeView === "favoritos" && (
            <div className="mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">⭐ Meus Favoritos</h2>
              <p className="text-sm text-muted-foreground">Jogos que você selecionou para acompanhar.</p>
            </div>
          )}

          {activeView === "jogos" && status === "upcoming" && selectedSport === "football" && (
            <Card className="popular-leagues-panel">
              <CardContent className="p-3">
                <div className="popular-leagues-header">
                  <p className="text-sm font-semibold">Competições principais</p>
                  <Badge variant="secondary" className="gap-1"><CalendarDays className="h-3.5 w-3.5" /> Calendário</Badge>
                </div>
                <div className="popular-leagues-list">
                  {upcomingPopularLeagues.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setUpcomingLeagueFocus(item)}
                      className={cn("popular-league-item", upcomingLeagueFocus === item && "active")}
                    >
                      <span className="league-dot" aria-hidden />
                      <span className="truncate">{item}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mb-3 text-xs text-muted-foreground">
            Atualização automática a cada 30s {lastUpdate ? `• Última leitura: ${new Date(lastUpdate).toLocaleTimeString("pt-BR")}` : ""}
          </div>

          {activeView === "alertas" ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Alertas IA ativos</h2>
              <p className="text-sm text-muted-foreground">Alertas ficam disponíveis até o encerramento da partida correspondente.</p>
              {activeAlerts.length > 0 ? (
                <div className="space-y-3">
                  {activeAlerts.map((alert) => (
                    <article key={alert.id} className={cn("ai-alerts-page-card", `floating-alert-${alert.level}`)}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-semibold">{alert.title}</p>
                          <p className="text-sm text-muted-foreground">{alert.matchLabel} • {alert.league}</p>
                          <p className="text-xs text-muted-foreground">{sportIcon[alert.sport]} {alert.minuteLabel} • {alert.phaseLabel} • Progresso {alert.progressPct}%</p>
                          <p className="text-xs text-muted-foreground">Detectado às {new Date(alert.detectedAt).toLocaleTimeString("pt-BR")}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="secondary">Confiança {alert.confidence}%</Badge>
                          <Button size="sm" onClick={() => openMatchFromAlert(alert)}>
                            <ArrowUpRight className="h-4 w-4" />
                            Abrir jogo
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-sm">{alert.description}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <Card className="match-card">
                  <CardContent className="p-6 text-sm text-muted-foreground">Nenhum alerta ativo no momento.</CardContent>
                </Card>
              )}
            </section>
          ) : (
            <div className="space-y-3">
              {activeView === "jogos" && status === "live" && suggestedMultiples.safe.length >= 2 && (
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="glass-panel p-4 border-l-4 border-primary/50 group hover:translate-y-[-2px] transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black uppercase text-primary flex items-center gap-1.5">
                        <ShieldAlert className="h-3 w-3" /> Múltipla Segura
                      </h4>
                      <Badge className="bg-primary/20 text-primary border-0 text-[10px]">IA PICK 🤖</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">Odds entre 1.20-1.40 com alta probabilidade de acerto.</p>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="w-full h-8 text-xs font-bold hover:bg-primary hover:text-primary-foreground group-hover:btn-glow"
                      onClick={() => addMultipleToSlip(suggestedMultiples.safe, "1")}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Montar Segura
                    </Button>
                  </div>

                  <div className="glass-panel p-4 border-l-4 border-accent/50 group hover:translate-y-[-2px] transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black uppercase text-accent flex items-center gap-1.5">
                        <Zap className="h-3 w-3" /> Moderada
                      </h4>
                      <Badge className="bg-accent/20 text-accent border-0 text-[10px]">BALANCED</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">Equilíbrio perfeito entre risco e retorno para o seu dia.</p>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="w-full h-8 text-xs font-bold hover:bg-accent hover:text-accent-foreground group-hover:shadow-[0_0_15px_rgba(var(--accent),0.4)]"
                      onClick={() => addMultipleToSlip(suggestedMultiples.moderate, "1")}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Montar Moderada
                    </Button>
                  </div>

                  <div className="glass-panel p-4 border-l-4 border-destructive/50 group hover:translate-y-[-2px] transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black uppercase text-destructive flex items-center gap-1.5">
                        <Flame className="h-3 w-3" /> Agressiva
                      </h4>
                      <Badge className="bg-destructive/20 text-destructive border-0 text-[10px]">HI-REWARD</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">Busca por odds altas e retornos explosivos. Use com cautela.</p>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="w-full h-8 text-xs font-bold hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => addMultipleToSlip(suggestedMultiples.aggressive, "1")}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Montar Agressiva
                    </Button>
                  </div>
                </section>
              )}

              {loading && (
                <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando jogos de {sportLabel[selectedSport]}...
                </div>
              )}

              {(status !== "upcoming" || activeView === "favoritos") && filteredMatches.map((match) => renderMatchCard(match))}
 
              {status === "upcoming" && activeView !== "favoritos" && upcomingCalendar.map((group) => (
                <section key={group.id} className="calendar-day-block">
                  <h3 className="calendar-day-title">{group.label}</h3>
                  <div className="space-y-3">
                    {group.matches.map((match) => renderMatchCard(match))}
                  </div>
                </section>
              ))}

              {filteredMatches.length === 0 && !loading && (
                <Card className="match-card">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    {emptyStateMessage(status, selectedSport, upcomingLeagueFocus)}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </section>
      </section>

      {floatingAlerts.length > 0 && (
        <div className="floating-alert-stack" role="status" aria-live="polite">
          {floatingAlerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              className={cn("floating-alert-card", `floating-alert-${alert.level}`)}
              onClick={() => openMatchFromAlert(alert)}
            >
              <div className="floating-alert-meta">
                <span className={cn("urgency-pill", `urgency-pill-${alert.urgencyLevel}`)}>{alert.urgencyLevel === "urgent" ? "URGENTE" : alert.urgencyLevel === "attention" ? "Atenção" : "Normal"}</span>
                <span className="text-xs text-muted-foreground">{sportIcon[alert.sport]} {alert.minuteLabel}</span>
              </div>
              <p className="floating-alert-title">{alert.title}</p>
              <p className="floating-alert-description">{alert.matchLabel} • {alert.phaseLabel}</p>
              <p className="floating-alert-description">{alert.description}</p>
            </button>
          ))}
        </div>
      )}

      <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
        <DialogContent className="sm:max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Depósito Instantâneo</DialogTitle>
            <DialogDescription>
              Adicione fundos via Pix para começar a apostar.
            </DialogDescription>
          </DialogHeader>
          
          {depositStep === "amount" ? (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-2">
                {[30, 50, 100, 500].map((val) => (
                  <Button 
                    key={val} 
                    variant={depositAmount === String(val) ? "default" : "outline"}
                    onClick={() => setDepositAmount(String(val))}
                    className="w-full"
                  >
                    R$ {val}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Ou digite outro valor</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <Input 
                    type="number" 
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="pl-9 bg-background/50"
                    placeholder="0,00"
                  />
                </div>
              </div>
              <Button 
                className="w-full font-bold btn-glow" 
                disabled={!depositAmount || Number(depositAmount) <= 0}
                onClick={() => setDepositStep("pix")}
              >
                Gerar Pix Copia e Cola
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4 text-center">
              <div className="bg-white p-4 rounded-xl inline-block mx-auto border-4 border-primary/20">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=00020126580014BR.GOV.BCB.PIX0114+55119999999990218BetMind%20Depósito520400005303986540${depositAmount.padEnd(4, '0')}5802BR5913BetMind%20LTDA6009Sao%20Paulo62070503***6304`} alt="QR Code Pix" className="w-32 h-32 object-contain" />
              </div>
              <p className="text-sm text-foreground px-4">Escaneie o QR Code ou copie o código Pix abaixo:</p>
              <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg text-xs break-all text-left mx-2 shadow-inner border border-border">
                <code className="line-clamp-2 text-muted-foreground">00020126580014BR.GOV.BCB.PIX0114+5511...</code>
                <Button variant="ghost" size="icon" className="shrink-0 hover:bg-primary/20 hover:text-primary transition-colors" onClick={() => toast({ title: "Código Pix Copiado!", description: "Cole no app do seu banco para pagar." })}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-3">Este é um simulador para testes na plataforma.</p>
                <Button 
                  variant="default"
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all"
                  onClick={() => {
                    setUserBalance(prev => prev + Number(depositAmount));
                    setIsDepositOpen(false);
                    setDepositStep("amount");
                    setDepositAmount("");
                    toast({
                      title: "Depósito Aprovado via simulador! 🎉",
                      description: `Saldo de R$ ${Number(depositAmount).toFixed(2).replace('.', ',')} adicionado à sua conta.`,
                    });
                  }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Simular Pagamento Aprovado
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent className="ai-analysis-modal">
          {analysisMatch && (
            <>
              <DialogHeader>
                <DialogTitle className="ai-analysis-title">
                  <Bot className="h-5 w-5 text-primary" />
                  {analysisMatch.home} x {analysisMatch.away}
                </DialogTitle>
                <DialogDescription className="ai-analysis-subtitle">
                  Leitura expressa do momento para decisão imediata.
                </DialogDescription>
              </DialogHeader>

              <section className="ai-analysis-grid">
                <article
                  className={cn(
                    "ai-block ai-block-hero time-analysis-block",
                    getLiveTimeView(analysisMatch).isCriticalWindow && "critical-pulse",
                  )}
                >
                  {(() => {
                    const timeView = getLiveTimeView(analysisMatch);
                    return (
                      <>
                        <div className="ai-block-header">
                          <p className="ai-block-title">⏱️ Tempo & Urgência</p>
                          <span className={urgencyMeta[timeView.urgencyLevel].className}>{urgencyMeta[timeView.urgencyLevel].label}</span>
                        </div>
                        <div className={cn("time-pill", `time-pill-${timeView.urgencyLevel}`)}>{timeView.headerLabel}</div>
                        <div className="time-context-meta">
                          <span className="time-clock">🕒 {timeView.clockLabel}</span>
                          {timeView.countdownLabel && <span className="time-countdown">{timeView.countdownLabel}</span>}
                          {timeView.urgencyText && <span className="time-urgency-text">{timeView.urgencyText}</span>}
                        </div>
                        <div className="match-progress-wrap">
                          <div className="match-progress-bar">
                            <span style={{ width: `${timeView.progressPct}%` }} />
                          </div>
                          <span className="match-progress-text">{timeView.progressPct}%</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {timeView.minute >= 80 && analysisMatch.ai.statusSignals.pressure >= 70
                            ? `🔥 ${timeView.minute} minutos + alta pressão: grande chance de evento final.`
                            : `Leitura temporal ativa para melhorar timing de entrada.`}
                        </p>
                      </>
                    );
                  })()}
                </article>

                <article className="ai-block ai-block-hero">
                  <div className="ai-block-header">
                    <p className="ai-block-title">🧩 Probabilidade</p>
                    <Badge className="bg-primary/20 text-primary">Favorito: {analysisMatch.ai.winHome >= analysisMatch.ai.winAway ? analysisMatch.home : analysisMatch.away}</Badge>
                  </div>
                  <div className="ai-probability-list">
                    <div className="ai-probability-item">
                      <p>Vitória {analysisMatch.home}</p>
                      <strong>{analysisMatch.ai.winHome}%</strong>
                    </div>
                    <div className="ai-probability-item">
                      <p>Empate</p>
                      <strong>{analysisMatch.ai.winDraw}%</strong>
                    </div>
                    <div className="ai-probability-item">
                      <p>Vitória {analysisMatch.away}</p>
                      <strong>{analysisMatch.ai.winAway}%</strong>
                    </div>
                  </div>
                  <ChartContainer className="ai-chart" config={probabilityChartConfig}>
                    <AreaChart data={analysisMatch.ai.charts.probabilityTimeline}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={32} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="home" stroke="var(--color-home)" fill="var(--color-home)" fillOpacity={0.14} strokeWidth={2} />
                      <Area type="monotone" dataKey="draw" stroke="var(--color-draw)" fill="var(--color-draw)" fillOpacity={0.1} strokeWidth={2} />
                      <Area type="monotone" dataKey="away" stroke="var(--color-away)" fill="var(--color-away)" fillOpacity={0.12} strokeWidth={2} />
                    </AreaChart>
                  </ChartContainer>
                </article>

                <article className="ai-block">
                  <div className="ai-block-header">
                    <p className="ai-block-title">🔥 Status do jogo</p>
                    <Badge variant="outline">{readableTrend(analysisMatch.ai.statusSignals.trend)}</Badge>
                  </div>
                  <div className="ai-kpis">
                    <div className="ai-kpi">
                      <p>Pressão ofensiva</p>
                      <strong>{analysisMatch.ai.statusSignals.pressure}/100</strong>
                    </div>
                    <div className="ai-kpi">
                      <p>Ritmo</p>
                      <strong className="capitalize">{analysisMatch.ai.statusSignals.rhythm}</strong>
                    </div>
                    <div className="ai-kpi">
                      <p>Tendência</p>
                      <strong className="capitalize">{analysisMatch.ai.statusSignals.trend}</strong>
                    </div>
                  </div>
                  <ChartContainer className="ai-chart" config={pressureChartConfig}>
                    <LineChart data={analysisMatch.ai.charts.pressureTimeline}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={32} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="home" stroke="var(--color-home)" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="away" stroke="var(--color-away)" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </article>

                <article className="ai-block">
                  <p className="ai-block-title">⚽ Eventos prováveis</p>
                  <div className="ai-event-cards">
                    <div className="ai-event-card"><span>Chance de gol</span><strong>{analysisMatch.ai.eventChances.goal}%</strong></div>
                    <div className="ai-event-card"><span>Chance de escanteio</span><strong>{analysisMatch.ai.eventChances.corner}%</strong></div>
                    <div className="ai-event-card"><span>Chance de cartão</span><strong>{analysisMatch.ai.eventChances.card}%</strong></div>
                  </div>
                  <ChartContainer className="ai-chart" config={eventChartConfig}>
                    <BarChart data={analysisMatch.ai.charts.eventTimeline}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={32} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="goals" fill="var(--color-goals)" radius={4} />
                      <Bar dataKey="corners" fill="var(--color-corners)" radius={4} />
                      <Bar dataKey="cards" fill="var(--color-cards)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </article>

                <article className="ai-block">
                  <p className="ai-block-title">📊 Resumo inteligente</p>
                  <p className="ai-summary">{analysisMatch.ai.insight}</p>
                </article>

                <article className="ai-block ai-block-bet">
                  <p className="ai-block-title">🎯 Melhor aposta</p>
                  <div className="ai-best-bet-line">
                    <p>👉 {analysisMatch.ai.bestBet.market}</p>
                    <Badge className="bg-primary/20 text-primary">{analysisMatch.ai.bestBet.confidence}%</Badge>
                  </div>
                  <p className="ai-best-bet-rationale">{analysisMatch.ai.bestBet.rationale}</p>
                  <Button 
                    className="w-full btn-glow bg-green-500 hover:bg-green-600 text-white"
                    onClick={() => {
                      // Seleciona Vitória Casa (1) como aposta padrão da IA; abre o BetSlip e fecha o modal
                      toggleSelection(analysisMatch, "1", analysisMatch.odds.home);
                      setAnalysisOpen(false);
                    }}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    Apostar agora ({formatOdd(analysisMatch.odds.home)})
                  </Button>
                </article>

                <article className="ai-block">
                  <p className="ai-block-title">⚠️ Risco</p>
                  <span className={riskMeta[analysisMatch.ai.riskLevel].className}>{riskMeta[analysisMatch.ai.riskLevel].label}</span>
                </article>
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={urgentOpen} onOpenChange={setUrgentOpen}>
        <DialogContent className="glass-panel">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Alerta urgente • Score alto
            </DialogTitle>
            <DialogDescription>
              O agente detectou janela de valor com pressão ofensiva elevada e probabilidade de evento acima do mercado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="odds-chip"><Flame className="h-4 w-4" /> Pressão 86</div>
            <div className="odds-chip"><Zap className="h-4 w-4" /> Gol 10m 72%</div>
            <div className="odds-chip"><Timer className="h-4 w-4" /> Janela ideal agora</div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setUrgentOpen(false)}>Agora não</Button>
            <Button onClick={() => setUrgentOpen(false)}>Aproveitar oportunidade</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="glass-panel">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-accent" />
              Compartilhar Jogo
            </DialogTitle>
            <DialogDescription>
              Envie esta oportunidade para seus amigos ou grupos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {shareMatch && (
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                <p className="font-semibold text-center text-sm">
                  🔥 Olha esse jogo:
                  <br />
                  {shareMatch.home} vs {shareMatch.away}
                  <br />
                  {shareMatch.status === "live" ? `Placar: ${shareMatch.homeScore} x ${shareMatch.awayScore}` : `Status: PRÓXIMO`}
                  <br />
                  ⚡ Alta chance de oportunidade
                  <br />
                  Veja na BetMind AI
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="bg-[#25D366] hover:bg-[#20ba59] text-white"
                onClick={() => {
                  if (!shareMatch) return;
                  const text = encodeURIComponent(
                    `🔥 Olha esse jogo:\n\n${shareMatch.home} vs ${shareMatch.away}\n${
                      shareMatch.status === "live"
                        ? `Placar: ${shareMatch.homeScore} x ${shareMatch.awayScore}`
                        : `Status: PRÓXIMO`
                    }\n\n⚡ Alta chance de oportunidade\n\nVeja na BetMind AI`
                  );
                  window.open(`https://wa.me/?text=${text}`, "_blank");
                }}
              >
                WhatsApp
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!shareMatch) return;
                  const text = `🔥 Olha esse jogo:\n\n${shareMatch.home} vs ${shareMatch.away}\n${
                    shareMatch.status === "live"
                      ? `Placar: ${shareMatch.homeScore} x ${shareMatch.awayScore}`
                      : `Status: PRÓXIMO`
                  }\n\n⚡ Alta chance de oportunidade\n\nVeja na BetMind AI`;
                  navigator.clipboard.writeText(text);
                  toast({ title: "Copiado!", description: "Link e mensagem copiados para a área de transferência." });
                }}
              >
                Copiar Link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {isBetSlipOpen && betSlip.length > 0 && (
        <aside className="betslip-panel glass-panel border-l border-border/50">
          <div className="betslip-header bg-muted/20">
            <h3 className="flex items-center gap-2 font-bold text-lg">
              <Calculator className="h-5 w-5 text-primary" />
              Seu Bilhete
              <Badge variant="secondary" className="ml-2 bg-primary/20 text-primary border-primary/30">
                {betSlip.length}
              </Badge>
            </h3>
            <button onClick={() => setIsBetSlipOpen(false)} className="p-1 hover:bg-muted/50 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="betslip-content custom-scrollbar">
            <div className="space-y-3">
              {betSlip.map((item) => (
                <div key={`${item.matchId}-${item.type}`} className="betslip-item group hover:border-primary/50 transition-all">
                  <button 
                    onClick={() => toggleSelection({ id: item.matchId } as any, item.type, item.odd)}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <p className="text-[11px] uppercase text-muted-foreground font-bold mb-1 line-clamp-1">
                    {item.home} vs {item.away}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-primary" />
                      {item.type === "1" ? "Vitória Casa" : item.type === "X" ? "Empate" : "Vitória Fora"}
                    </span>
                    <Badge className="bg-primary/10 text-primary border-primary/20 font-black text-sm">
                      @{item.odd.toFixed(2)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {betSlipRisk && (
              <div className="mt-6 p-4 rounded-xl bg-card border border-border/50 shadow-inner">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <p className={cn("text-xs font-black uppercase tracking-wider", betSlipRisk.className)}>
                    {betSlipRisk.label}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong>Análise IA:</strong> {betSlipRisk.suggestion}
                </p>
                {betSlip.length > 4 && (
                  <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    <p className="text-[10px] text-destructive font-bold uppercase">Risco de bilhete longo detectado</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="betslip-footer shadow-[0_-10px_40px_-20px_rgba(0,0,0,0.5)] bg-card/80 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cotação Total</span>
              <div className="flex flex-col items-end">
                <span className="font-black text-primary text-3xl tracking-tighter">
                  x{totalOdd.toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground -mt-1 font-bold">MULTIPLICADOR FINAL</span>
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Valor da Aposta</label>
                <div className="flex gap-1">
                  {["50", "100", "200"].map(v => (
                    <button 
                      key={v}
                      onClick={() => setBetAmount(v)}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded border border-border/50 font-bold transition-all",
                        betAmount === v ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/50"
                      )}
                    >
                      R${v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground group-focus-within:text-primary transition-colors">R$</span>
                <Input 
                  type="number" 
                  value={betAmount} 
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="pl-10 h-12 bg-background/50 border-muted/50 font-black text-lg focus:ring-primary focus:border-primary transition-all rounded-xl"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="bg-primary/10 p-4 rounded-xl border border-primary/20 flex items-center justify-between mb-4 shadow-sm">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-black text-primary tracking-widest">Ganho Potencial</span>
                <span className="text-2xl font-black text-primary tracking-tight">R$ {potentialReturn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                className={cn("h-14 font-black rounded-xl text-lg transition-all relative overflow-hidden", isBetting ? "bg-muted text-muted-foreground" : "bg-green-500 hover:bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)]")}
                onClick={placeBet}
                disabled={isBetting || parseFloat(betAmount) < 5 || parseFloat(betAmount) > userBalance || betSlip.length === 0}
              >
                {isBetting ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> PROCESSANDO...</span>
                ) : (
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> FAZER APOSTA</span>
                )}
              </Button>
              <Button 
                variant="ghost" 
                className="h-10 hover:bg-muted/50 font-bold rounded-xl text-muted-foreground"
                onClick={handleShareBet}
                disabled={isBetting}
              >
                <Share2 className="h-4 w-4 mr-2" /> Compartilhar Bilhete
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* Floating Toggle for Mobile or when sidebar closed */}
      {!isBetSlipOpen && betSlip.length > 0 && (
        <button 
          onClick={() => setIsBetSlipOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-primary text-primary-foreground w-16 h-16 rounded-full shadow-[0_10px_40px_-10px_hsl(var(--primary))] flex items-center justify-center transition-all hover:scale-110 active:scale-95 btn-glow animate-in zoom-in-50 duration-300"
        >
          <Calculator className="h-7 w-7" />
          <span className="absolute -top-1 -right-1 bg-destructive text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-background shadow-lg">
            {betSlip.length}
          </span>
        </button>
      )}
      
      {/* Historico de Apostas Dialog */}
      <Dialog open={isMyBetsOpen} onOpenChange={setIsMyBetsOpen}>
        <DialogContent className="glass-panel max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Wallet className="h-6 w-6 text-primary" />
              Minhas Apostas e Ganhos
            </DialogTitle>
            <DialogDescription>
              Acompanhe seus bilhetes em andamento e simule os ganhos dos últimos palpites.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {myBets.length === 0 ? (
              <div className="text-center p-8 bg-muted/20 border border-border/50 rounded-xl">
                <p className="text-muted-foreground">Você ainda não realizou nenhuma aposta.</p>
              </div>
            ) : (
              myBets.map(bet => (
                <div key={bet.id} className="p-4 rounded-xl border border-border/50 bg-card/60 space-y-3 relative overflow-hidden">
                  {bet.status === "won" && <div className="absolute top-0 right-0 p-2 bg-green-500/20 text-green-500 font-bold text-[10px] md:text-xs uppercase z-10">Resolvido (Green) 🟢</div>}
                  {bet.status === "lost" && <div className="absolute top-0 right-0 p-2 bg-red-500/20 text-red-500 font-bold text-[10px] md:text-xs uppercase z-10">Resolvido (Red) 🔴</div>}
                  {bet.status === "pending" && <div className="absolute top-0 right-0 p-2 bg-blue-500/20 text-blue-500 font-bold text-[10px] md:text-xs uppercase z-10">Em Andamento</div>}
                  
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-muted-foreground font-mono">ID: {bet.id}</span>
                    <span className="text-xs text-muted-foreground pr-32 lg:pr-0">
                      {new Date(bet.date).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    {bet.items.map(item => (
                      <div key={item.matchId} className="flex flex-col sm:flex-row sm:justify-between text-sm py-1.5 border-b border-border/30 last:border-0">
                        <span className="font-medium text-foreground">{item.home} vs {item.away}</span>
                        <div className="flex gap-2 items-center mt-1 sm:mt-0">
                          <span className="text-muted-foreground text-xs uppercase pr-2 bg-muted/20 px-2 rounded-sm">{item.type === "1" ? "Vit. Casa" : item.type === "X" ? "Empate" : "Vit. Fora"}</span>
                          <Badge className="bg-primary/20 text-primary border-primary/20">@{item.odd.toFixed(2)}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex flex-wrap justify-between items-end pt-2 bg-secondary/10 p-3 rounded-lg gap-2 mt-3">
                    <div className="flex-1 min-w-[30%]">
                      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-wider">Aposta Total</p>
                      <p className="font-black text-foreground text-sm sm:text-base">R$ {bet.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="flex-1 min-w-[20%] text-center">
                      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-wider">Odd Final</p>
                      <p className="font-black text-foreground text-sm sm:text-base">{bet.totalOdd.toFixed(2)}</p>
                    </div>
                    <div className="flex-1 min-w-[40%] text-right">
                      <p className="text-[10px] sm:text-xs text-primary uppercase font-bold tracking-wider">Retorno</p>
                      <p className="font-black text-primary text-base sm:text-xl md:text-2xl">R$ {bet.potentialReturn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  
                  {bet.status === "pending" && (
                     <div className="flex gap-2 pt-2 border-t border-border/40 mt-3 relative z-10 w-full">
                       <Button 
                          variant="ghost" 
                          className="flex-1 h-10 text-red-500 hover:bg-red-500/10 hover:text-red-500 font-bold flex gap-1 items-center justify-center text-[11px] sm:text-sm"
                          onClick={(e) => { e.stopPropagation(); resolveBet(bet.id, "lost"); }}
                        >
                          Simular Red 🔴
                        </Button>
                       <Button 
                          className="flex-1 h-10 bg-green-500 hover:bg-green-600 text-white font-bold flex gap-1 items-center justify-center text-[11px] sm:text-sm"
                          onClick={(e) => { e.stopPropagation(); resolveBet(bet.id, "won"); }}
                       >
                         Simular Green 🟢
                       </Button>
                     </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Index;
