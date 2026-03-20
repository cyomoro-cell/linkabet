import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Match {
  id: string;
  sport: string;
  league: string;
  homeTeam: { id: string; name: string; score?: number };
  awayTeam: { id: string; name: string; score?: number };
  odds: { home: number; draw?: number; away: number };
  startTime: string;
  isLive: boolean;
  minute?: number;
}

// ─── AllSportsAPI via RapidAPI ───
// Host: allsportsapi2.p.rapidapi.com
// Docs: https://allsportsapi.com/soccer-football-api-documentation

const API_HOST = "allsportsapi2.p.rapidapi.com";
const API_BASE = `https://${API_HOST}`;

// Sport configs for AllSportsAPI
const SPORT_CONFIGS = [
  { path: "football", sport: "football" },
  { path: "basketball", sport: "basketball" },
  { path: "tennis", sport: "tennis" },
  { path: "cricket", sport: "cricket" },
  { path: "hockey", sport: "ice hockey" },
  { path: "baseball", sport: "baseball" },
  { path: "american-football", sport: "american football" },
  { path: "mma", sport: "mma" },
];

async function fetchAllSportsAPI(rapidApiKey: string): Promise<Match[]> {
  const headers = {
    "X-RapidAPI-Key": rapidApiKey,
    "X-RapidAPI-Host": API_HOST,
  };

  const allMatches: Match[] = [];
  const today = getTodayDate();
  const tomorrow = getTomorrowDate();

  // Fetch livescores and fixtures for each sport in parallel
  const promises: Promise<Match[]>[] = [];

  for (const config of SPORT_CONFIGS) {
    // Livescores
    promises.push(
      fetchEndpoint(
        `${API_BASE}/api/${config.path}/matches/live`,
        `${config.sport} live`, headers, config.sport, true
      )
    );
    // Today's fixtures
    promises.push(
      fetchEndpoint(
        `${API_BASE}/api/${config.path}/matches/${today}`,
        `${config.sport} today`, headers, config.sport, false
      )
    );
  }

  // Also fetch tomorrow for football
  promises.push(
    fetchEndpoint(
      `${API_BASE}/api/football/matches/${tomorrow}`,
      "football tomorrow", headers, "football", false
    )
  );

  const results = await Promise.allSettled(promises);
  const existingIds = new Set<string>();

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const m of result.value) {
        if (!existingIds.has(m.id)) {
          allMatches.push(m);
          existingIds.add(m.id);
        }
      }
    }
  }

  console.log(`AllSportsAPI total: ${allMatches.length} matches`);
  return allMatches;
}

async function fetchEndpoint(
  url: string, label: string, headers: Record<string, string>,
  sport: string, isLive: boolean
): Promise<Match[]> {
  const matches: Match[] = [];
  try {
    console.log(`Fetching ${label}...`);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`${label} error: ${res.status} - ${body.substring(0, 150)}`);
      return [];
    }
    const data = await res.json();
    const events = data.events || data.matches || data.data || [];
    
    if (!Array.isArray(events)) {
      console.log(`${label}: unexpected response format`);
      return [];
    }
    
    console.log(`${label}: ${events.length} events`);

    for (const event of events.slice(0, 30)) {
      const parsed = parseEvent(event, sport, isLive);
      if (parsed) matches.push(parsed);
    }
  } catch (e) {
    console.error(`${label} error:`, e);
  }
  return matches;
}

function parseEvent(event: any, sport: string, fromLive: boolean): Match | null {
  try {
    // AllSportsAPI event structure
    const homeTeam = event.homeTeam || event.home_team || event.homeScore?.current !== undefined ? event : null;
    const awayTeam = event.awayTeam || event.away_team;

    // Try different field names
    const homeName = event.homeTeam?.name || event.home_team_name || event.strHomeTeam || event.homeTeam?.shortName || "";
    const awayName = event.awayTeam?.name || event.away_team_name || event.strAwayTeam || event.awayTeam?.shortName || "";
    
    if (!homeName || !awayName) return null;

    const homeId = event.homeTeam?.id || event.home_team_key || event.idHomeTeam || String(event.id) + "_h";
    const awayId = event.awayTeam?.id || event.away_team_key || event.idAwayTeam || String(event.id) + "_a";

    // Scores
    const homeScore = event.homeScore?.current ?? event.home_score ?? event.intHomeScore ?? undefined;
    const awayScore = event.awayScore?.current ?? event.away_score ?? event.intAwayScore ?? undefined;

    // Status
    const statusType = event.status?.type || "";
    const statusDesc = event.status?.description || event.match_status || "";
    const isLive = fromLive || statusType === "inprogress" || ["1H", "2H", "HT", "ET", "LIVE"].includes(statusDesc);
    const isFinished = statusType === "finished" || ["FT", "AET", "PEN", "AP"].includes(statusDesc);
    if (isFinished) return null;

    // Minute
    let minute: number | undefined;
    if (isLive) {
      minute = event.time?.currentPeriodStart || event.match_minute || event.status?.liveMinute;
      if (!minute && event.statusTime) minute = parseInt(event.statusTime);
    }

    // League
    const league = event.tournament?.name || event.league_name || event.strLeague || "Unknown League";

    // Start time
    const startTimestamp = event.startTimestamp || event.match_time;
    const startTime = startTimestamp 
      ? new Date(typeof startTimestamp === 'number' ? startTimestamp * 1000 : startTimestamp).toISOString()
      : event.startTime || new Date().toISOString();

    // Odds
    const odds = parseEventOdds(event, sport);

    return {
      id: `AS_${event.id || event.match_id || Math.random().toString(36).substring(7)}`,
      sport,
      league,
      homeTeam: {
        id: `AS_${homeId}`,
        name: homeName,
        score: isLive ? (homeScore !== undefined ? Number(homeScore) : 0) : undefined,
      },
      awayTeam: {
        id: `AS_${awayId}`,
        name: awayName,
        score: isLive ? (awayScore !== undefined ? Number(awayScore) : 0) : undefined,
      },
      odds,
      startTime,
      isLive,
      minute,
    };
  } catch (e) {
    console.error("Parse error:", e);
    return null;
  }
}

function parseEventOdds(event: any, sport: string): { home: number; draw?: number; away: number } {
  try {
    if (event.odds) {
      const h = event.odds["1"] || event.odds.home;
      const d = event.odds["X"] || event.odds.draw;
      const a = event.odds["2"] || event.odds.away;
      if (h && a) {
        return { home: parseFloat(h), draw: d ? parseFloat(d) : undefined, away: parseFloat(a) };
      }
    }
  } catch {}
  return generateFallbackOdds(sport);
}

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getTomorrowDate(): string {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function generateFallbackOdds(sport: string) {
  if (sport === "football" || sport === "soccer") {
    return { home: parseFloat((1.5 + Math.random() * 2).toFixed(2)), draw: parseFloat((2.5 + Math.random() * 1.5).toFixed(2)), away: parseFloat((1.8 + Math.random() * 2.2).toFixed(2)) };
  }
  return { home: parseFloat((1.6 + Math.random() * 1.5).toFixed(2)), away: parseFloat((2.0 + Math.random() * 1.8).toFixed(2)) };
}

function generateMockMatches(count: number): Match[] {
  const sports = [
    { name: "football", leagues: ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "Champions League"] },
    { name: "basketball", leagues: ["NBA", "EuroLeague"] },
    { name: "tennis", leagues: ["ATP Tour", "WTA Tour"] },
    { name: "ice hockey", leagues: ["NHL", "KHL"] },
    { name: "mma", leagues: ["UFC", "Bellator"] },
    { name: "baseball", leagues: ["MLB", "NPB"] },
  ];
  const teams: Record<string, string[]> = {
    football: ["Manchester City", "Liverpool", "Real Madrid", "Barcelona", "Bayern Munich", "PSG", "Juventus", "AC Milan", "Inter Milan", "Chelsea"],
    basketball: ["Lakers", "Warriors", "Celtics", "Bucks", "Heat", "Suns", "Nuggets", "76ers"],
    tennis: ["Djokovic", "Alcaraz", "Sinner", "Medvedev", "Zverev", "Fritz"],
    "ice hockey": ["Bruins", "Rangers", "Oilers", "Panthers", "Avalanche", "Stars"],
    mma: ["Fighter A", "Fighter B", "Champion X", "Contender Y"],
    baseball: ["Yankees", "Dodgers", "Braves", "Astros", "Mets", "Phillies"],
  };
  const matches: Match[] = [];
  for (let i = 0; i < count; i++) {
    const sport = sports[Math.floor(Math.random() * sports.length)];
    const league = sport.leagues[Math.floor(Math.random() * sport.leagues.length)];
    const t = teams[sport.name] || ["Team A", "Team B"];
    const hi = Math.floor(Math.random() * t.length);
    let ai = Math.floor(Math.random() * t.length);
    while (ai === hi && t.length > 1) ai = Math.floor(Math.random() * t.length);
    matches.push({
      id: `MOCK_${sport.name}_${league.replace(/\s/g, "")}_${i}_${Date.now()}`,
      sport: sport.name, league,
      homeTeam: { id: `home_${i}`, name: t[hi] },
      awayTeam: { id: `away_${i}`, name: t[ai] },
      odds: generateFallbackOdds(sport.name),
      startTime: new Date(Date.now() + (15 + Math.random() * 168) * 60 * 1000).toISOString(),
      isLive: false,
    });
  }
  return matches;
}

function shiftOdds(odds: { home: number; draw?: number; away: number }) {
  return {
    home: parseFloat(Math.max(1.01, odds.home + (Math.random() - 0.5) * 0.08).toFixed(2)),
    away: parseFloat(Math.max(1.01, odds.away + (Math.random() - 0.5) * 0.08).toFixed(2)),
    ...(odds.draw !== undefined ? { draw: parseFloat(Math.max(1.01, odds.draw + (Math.random() - 0.5) * 0.08).toFixed(2)) } : {}),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let allMatches: Match[] = [];
    let source = "mock-fallback";

    // Primary: AllSportsAPI via RapidAPI
    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");
    if (rapidApiKey) {
      console.log("Using AllSportsAPI (RapidAPI)...");
      allMatches = await fetchAllSportsAPI(rapidApiKey);
      if (allMatches.length > 0) source = "AllSportsAPI";
    }

    // Update live odds for existing DB matches
    const { data: existingMatches } = await supabase.from("matches").select("id, odds, is_live, minute").eq("is_live", true);
    if (existingMatches?.length) {
      for (const existing of existingMatches) {
        if (!allMatches.find(m => m.id === existing.id)) {
          await supabase.from("matches").update({ odds: shiftOdds(existing.odds as any), minute: (existing.minute || 0) + 1, updated_at: new Date().toISOString() }).eq("id", existing.id);
        }
      }
    }

    // Fill with mocks if needed
    if (allMatches.length < 15) {
      const mockCount = 15 - allMatches.length;
      console.log(`Adding ${mockCount} mock matches`);
      allMatches.push(...generateMockMatches(mockCount));
    }

    allMatches.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    const uniqueMap = new Map<string, Match>();
    for (const m of allMatches) uniqueMap.set(m.id, m);
    const uniqueMatches = Array.from(uniqueMap.values()).filter(m => {
      if (!m.isLive && new Date(m.startTime).getTime() < Date.now()) return false;
      if (m.isLive && m.minute && m.minute > 90) return false;
      return true;
    });

    const dbRows = uniqueMatches.map(m => ({
      id: m.id, sport: m.sport, league: m.league, home_team: m.homeTeam, away_team: m.awayTeam,
      odds: m.odds, start_time: m.startTime, is_live: m.isLive, minute: m.minute || null, updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase.from("matches").upsert(dbRows, { onConflict: "id" });
    if (upsertError) console.error("Upsert error:", upsertError);
    else console.log(`Upserted ${dbRows.length} matches (source: ${source})`);

    await supabase.from("matches").delete().eq("is_live", false).lt("start_time", new Date().toISOString());
    await supabase.from("matches").delete().eq("is_live", true).gt("minute", 90);

    return new Response(JSON.stringify({ matches: uniqueMatches, count: uniqueMatches.length, source }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ matches: generateMockMatches(15), source: "mock-fallback" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
