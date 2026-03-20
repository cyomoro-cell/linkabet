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

// ─── AllSportsAPI via RapidAPI (SofaScore data) ───
const API_HOST = "allsportsapi2.p.rapidapi.com";
const API_BASE = `https://${API_HOST}`;

// Sports to fetch — using known endpoint patterns
const SPORTS = [
  { slug: "football", sport: "football" },
  { slug: "basketball", sport: "basketball" },
  { slug: "tennis", sport: "tennis" },
  { slug: "cricket", sport: "cricket" },
  { slug: "ice-hockey", sport: "ice hockey" },
  { slug: "baseball", sport: "baseball" },
  { slug: "american-football", sport: "american football" },
  { slug: "mma", sport: "mma" },
];

async function fetchAllSportsAPI(rapidApiKey: string): Promise<Match[]> {
  const headers = {
    "X-RapidAPI-Key": rapidApiKey,
    "X-RapidAPI-Host": API_HOST,
  };

  const allMatches: Match[] = [];
  const existingIds = new Set<string>();

  // SofaScore-style: /api/sport/scheduled-events/YYYY-MM-DD
  // and /api/sport/events/live
  const today = getTodayDate();

  // Fetch sequentially to avoid rate limits (free tier)
  for (const s of SPORTS) {
    if (allMatches.length >= 60) break;

    // Try scheduled events for today
    const scheduled = await fetchEndpoint(
      `${API_BASE}/api/${s.slug}/scheduled-events/${today}`,
      `${s.sport} scheduled`, headers, s.sport, false
    );
    for (const m of scheduled) {
      if (!existingIds.has(m.id)) { allMatches.push(m); existingIds.add(m.id); }
    }

    // Small delay to avoid rate limit
    await delay(200);

    // Try live events
    const live = await fetchEndpoint(
      `${API_BASE}/api/${s.slug}/events/live`,
      `${s.sport} live`, headers, s.sport, true
    );
    for (const m of live) {
      if (!existingIds.has(m.id)) { allMatches.push(m); existingIds.add(m.id); }
    }

    await delay(200);
  }

  // If still low, try tomorrow for football
  if (allMatches.length < 20) {
    const tomorrow = getTomorrowDate();
    const tomorrowMatches = await fetchEndpoint(
      `${API_BASE}/api/football/scheduled-events/${tomorrow}`,
      "football tomorrow", headers, "football", false
    );
    for (const m of tomorrowMatches) {
      if (!existingIds.has(m.id)) { allMatches.push(m); existingIds.add(m.id); }
    }
  }

  console.log(`AllSportsAPI total: ${allMatches.length} matches`);
  return allMatches;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
      console.warn(`${label}: ${res.status} - ${body.substring(0, 100)}`);
      return [];
    }
    const data = await res.json();
    
    // AllSportsAPI returns { events: [...] }
    const events = data.events || [];
    if (!Array.isArray(events)) {
      console.log(`${label}: no events array, keys: ${Object.keys(data).join(",")}`);
      return [];
    }
    
    console.log(`${label}: ${events.length} events`);

    for (const event of events.slice(0, 25)) {
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
    // SofaScore/AllSportsAPI event structure
    const homeName = event.homeTeam?.name || event.homeTeam?.shortName || "";
    const awayName = event.awayTeam?.name || event.awayTeam?.shortName || "";
    if (!homeName || !awayName) return null;

    const homeId = event.homeTeam?.id || "";
    const awayId = event.awayTeam?.id || "";

    // Status
    const statusCode = event.status?.code;
    const statusType = event.status?.type || "";
    // code: 0=not started, 6=1st half, 7=2nd half, 31=HT, 100=ended, etc.
    const isFinished = statusType === "finished" || statusCode === 100;
    if (isFinished) return null;

    const isLive = fromLive || statusType === "inprogress" || [6, 7, 31, 41, 42].includes(statusCode);

    // Scores
    const homeScore = event.homeScore?.current ?? event.homeScore?.display;
    const awayScore = event.awayScore?.current ?? event.awayScore?.display;

    // Minute
    let minute: number | undefined;
    if (isLive) {
      // SofaScore uses statusTime or we can calculate from startTimestamp
      if (event.statusTime?.played) {
        minute = Math.floor(event.statusTime.played / 60);
      } else if (event.time?.currentPeriodStartTimestamp) {
        const elapsed = Math.floor((Date.now() / 1000 - event.time.currentPeriodStartTimestamp));
        minute = Math.max(0, Math.floor(elapsed / 60));
      } else if (event.startTimestamp) {
        const elapsed = Math.floor(Date.now() / 1000 - event.startTimestamp);
        minute = Math.min(90, Math.max(0, Math.floor(elapsed / 60)));
      }
    }

    // Tournament / League
    const league = event.tournament?.name || event.tournament?.uniqueTournament?.name || "Unknown League";

    // Start time
    const startTime = event.startTimestamp
      ? new Date(event.startTimestamp * 1000).toISOString()
      : new Date().toISOString();

    return {
      id: `AS_${event.id}`,
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
      odds: generateFallbackOdds(sport),
      startTime,
      isLive,
      minute,
    };
  } catch (e) {
    console.error("Parse error:", e);
    return null;
  }
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
