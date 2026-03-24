import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = Object.fromEntries(
  envContent.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const idx = line.indexOf('=');
      if (idx === -1) return [line, ''];
      let val = line.slice(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      return [line.slice(0, idx).trim(), val];
    })
);

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const EDGE_URL = `${supabaseUrl}/functions/v1/external-ingest`;
const TOKEN = 'Brunn@80';

// Cache de mapeamentos salvos localmente para não re-inserir em re-execuções
const CACHE_FILE = path.resolve(process.cwd(), 'scripts', '.ingest_cache.json');

function loadCache(): { teams: Record<string, string>; matches: Record<string, string> } {
  if (fs.existsSync(CACHE_FILE)) {
    try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')); } catch {}
  }
  return { teams: {}, matches: {} };
}

function saveCache(cache: { teams: Record<string, string>; matches: Record<string, string> }) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function edgePost(body: object): Promise<any> {
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-token': TOKEN },
    body: JSON.stringify(body)
  });
  const txt = await res.text();
  if (!res.ok) return null;
  try { return JSON.parse(txt); } catch { return null; }
}

// Insere 1 time por vez para capturar o id gerado
async function insertTeamSingle(name: string): Promise<string | null> {
  const result = await edgePost({ table: 'teams', method: 'INSERT', records: [{ name }] });
  if (result?.ids?.[0]) return result.ids[0] as string;
  return null;
}

async function main() {
  console.log('=== BetMind - Integração de Dados Históricos ===\n');
  const matchesDir = path.resolve(process.cwd(), 'public', 'matches');
  const eventsDir = path.resolve(process.cwd(), 'public', 'events');
  const cache = loadCache();
  const teamNameToDbId: Record<string, string> = cache.teams;
  const extMatchToDbId: Record<string, string> = cache.matches;

  // 1. Coletar times e partidas dos JSONs
  console.log('1. Lendo arquivos JSON...');
  const extTeamIdToName = new Map<number, string>();
  const allMatchesRaw: any[] = [];

  for (const compId of fs.readdirSync(matchesDir)) {
    const compDir = path.join(matchesDir, compId);
    if (!fs.statSync(compDir).isDirectory()) continue;
    for (const file of fs.readdirSync(compDir)) {
      if (!file.endsWith('.json')) continue;
      const data = JSON.parse(fs.readFileSync(path.join(compDir, file), 'utf-8'));
      for (const m of data) {
        extTeamIdToName.set(m.home_team.home_team_id, m.home_team.home_team_name);
        extTeamIdToName.set(m.away_team.away_team_id, m.away_team.away_team_name);
        allMatchesRaw.push(m);
      }
    }
  }
  const allTeamNames = [...new Set(extTeamIdToName.values())];
  console.log(`   ${allTeamNames.length} times únicos, ${allMatchesRaw.length} partidas\n`);

  // 2. Inserir times que ainda não estão no cache
  const missingTeams = allTeamNames.filter(name => !teamNameToDbId[name]);
  console.log(`2. Inserindo ${missingTeams.length} times novos (1 a 1)...`);
  let teamsInserted = 0;
  for (const name of missingTeams) {
    const id = await insertTeamSingle(name);
    if (id) {
      teamNameToDbId[name] = id;
      teamsInserted++;
    }
    // Salvar cache periodicamente
    if (teamsInserted % 50 === 0) saveCache({ teams: teamNameToDbId, matches: extMatchToDbId });
    process.stdout.write(`\r   ${teamsInserted}/${missingTeams.length} inseridos`);
  }
  saveCache({ teams: teamNameToDbId, matches: extMatchToDbId });
  console.log(`\n   Total times no cache: ${Object.keys(teamNameToDbId).length}\n`);

  // Recriar mapeamento extId→dbId
  const extTeamIdToDbId = new Map<number, string>();
  for (const [extId, name] of extTeamIdToName) {
    if (teamNameToDbId[name]) extTeamIdToDbId.set(extId, teamNameToDbId[name]);
  }

  // 3. Inserir partidas
  const matchesToInsert = allMatchesRaw
    .filter(m => !extMatchToDbId[m.match_id.toString()])
    .map(m => ({
      external_match_id: m.match_id.toString(),
      home_team_id: extTeamIdToDbId.get(m.home_team.home_team_id),
      away_team_id: extTeamIdToDbId.get(m.away_team.away_team_id),
      home_score: m.home_score,
      away_score: m.away_score,
      match_date: m.match_date,
      league: m.competition?.competition_name || 'La Liga',
      season: m.season?.season_name || null
    }))
    .filter(m => m.home_team_id && m.away_team_id);

  console.log(`3. Inserindo ${matchesToInsert.length} partidas...`);
  const MATCH_BATCH = 50;
  let matchesInserted = 0;

  for (let i = 0; i < matchesToInsert.length; i += MATCH_BATCH) {
    const chunk = matchesToInsert.slice(i, i + MATCH_BATCH);
    const result = await edgePost({ table: 'matches_history', method: 'INSERT', records: chunk });
    if (result?.ids && Array.isArray(result.ids)) {
      result.ids.forEach((id: string, idx: number) => {
        extMatchToDbId[chunk[idx].external_match_id] = id;
        matchesInserted++;
      });
    }
    if (matchesInserted % 200 === 0) saveCache({ teams: teamNameToDbId, matches: extMatchToDbId });
    process.stdout.write(`\r   ${matchesInserted}/${matchesToInsert.length} partidas inseridas`);
  }
  saveCache({ teams: teamNameToDbId, matches: extMatchToDbId });
  console.log(`\n   Partidas no cache: ${Object.keys(extMatchToDbId).length}\n`);

  // 4. Inserir eventos
  console.log('4. Processando eventos...');
  const eventFiles = new Set(fs.readdirSync(eventsDir).map(f => f.replace('.json', '')));
  let totalEvents = 0;
  let done = 0;
  const matchIds = Object.entries(extMatchToDbId);

  for (const [extMatchId, dbMatchId] of matchIds) {
    if (!eventFiles.has(extMatchId)) continue;
    const eventFile = path.join(eventsDir, `${extMatchId}.json`);
    const eventData: any[] = JSON.parse(fs.readFileSync(eventFile, 'utf-8'));

    const events = eventData.map(e => ({
      match_id: dbMatchId,
      minute: e.minute ?? null,
      team_id: e.team?.id ? (extTeamIdToDbId.get(e.team.id) || null) : null,
      type: e.type?.name ?? 'Unknown'
    }));

    // Inserir 100 por vez
    for (let i = 0; i < events.length; i += 100) {
      const chunk = events.slice(i, i + 100);
      const result = await edgePost({ table: 'events', method: 'INSERT', records: chunk });
      if (result?.inserted || result?.success) totalEvents += chunk.length;
    }
    done++;
    process.stdout.write(`\r   ${done} partidas, ${totalEvents} eventos inseridos`);
  }
  if (totalEvents > 0) console.log();

  console.log(`\n=== Integração concluída! ===`);
  console.log(`  Times: ${Object.keys(teamNameToDbId).length}`);
  console.log(`  Partidas: ${Object.keys(extMatchToDbId).length}`);
  console.log(`  Eventos inseridos: ${totalEvents}`);
}

main().catch(console.error);
