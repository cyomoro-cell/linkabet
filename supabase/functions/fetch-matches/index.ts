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

// ─── API-Football via RapidAPI ───
// Host: api-football-v1.p.rapidapi.com
// Docs: https://www.api-football.com/documentation-v3

const API_FOOTBALL_HOST = "api-football-v1.p.rapidapi.com";
const API_FOOTBALL_BASE = `https://${API_FOOTBALL_HOST}/v3`;

async function fetchAPIFootball(rapidApiKey: string): Promise<Match[]> {
  const headers = {
    "X-RapidAPI-Key": rapidApiKey,
    "X-RapidAPI-Host": API_FOOTBALL_HOST,
  };

  const allMatches: Match[] = [];
  const existingIds = new Set<string>();

  // Fetch live matches and today's fixtures in parallel
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const [liveResult, todayResult, tomorrowResult] = await Promise.allSettled([
    fetchAFEndpoint(`${API_FOOTBALL_BASE}/fixtures?live=all`, "live", headers, true),
    fetchAFEndpoint(`${API_FOOTBALL_BASE}/fixtures?date=${today}`, "today", headers, false),
    fetchAFEndpoint(`${API_FOOTBALL_BASE}/fixtures?date=${tomorrow}`, "tomorrow", headers, false),
  ]);

  for (const result of [liveResult, todayResult, tomorrowResult]) {
    if (result.status === "fulfilled") {
      for (const m of result.value) {
        if (!existingIds.has(m.id)) {
          allMatches.push(m);
          existingIds.add(m.id);
        }
      }
    }
  }

  // If we have fixtures, try to get odds for some of them
  if (allMatches.length > 0) {
    try {
      const oddsRes = await fetch(`${API_FOOTBALL_BASE}/odds?date=${today}&bookmaker=8`, { headers });
      if (oddsRes.ok) {
        const oddsData = await oddsRes.json();
        const oddsMap = parseOddsResponse(oddsData);
        for (const match of allMatches) {
          const fixtureId = match.id.replace("AF_", "");
          if (oddsMap.has(fixtureId)) {
            match.odds = oddsMap.get(fixtureId)!;
          }
        }
        console.log(`API-Football odds: ${oddsMap.size} fixtures with odds`);
      }
    } catch (e) {
      console.warn("Odds fetch error:", e);
    }
  }

  console.log(`API-Football total: ${allMatches.length} matches`);
  return allMatches;
}

async function fetchAFEndpoint(url: string, label: string, headers: Record<string, string>, isLive: boolean): Promise<Match[]> {
  const matches: Match[] = [];
  try {
    console.log(`API-Football: fetching ${label}...`);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`API-Football ${label} error: ${res.status}`);
      const body = await res.text();
      console.warn(`API-Football ${label} body: ${body.substring(0, 200)}`);
      return [];
    }
    const data = await res.json();
    const fixtures = data.response || [];
    console.log(`API-Football ${label}: ${fixtures.length} fixtures`);

    for (const fixture of fixtures.slice(0, 60)) {
      const parsed = parseAFFixture(fixture, isLive);
      if (parsed) matches.push(parsed);
    }
  } catch (e) {
    console.error(`API-Football ${label} error:`, e);
  }
  return matches;
}

function parseAFFixture(fixture: any, fromLiveEndpoint: boolean): Match | null {
  try {
    const f = fixture.fixture;
    const teams = fixture.teams;
    const goals = fixture.goals;
    const league = fixture.league;
    const score = fixture.score;

    if (!f || !teams?.home || !teams?.away) return null;

    // Determine status
    const status = f.status?.short || "";
    const endedStatuses = ["FT", "AET", "PEN", "WO", "AWD", "CANC", "ABD", "PST"];
    if (endedStatuses.includes(status)) return null;

    const liveStatuses = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"];
    const isLive = fromLiveEndpoint || liveStatuses.includes(status);

    // Parse minute
    let minute: number | undefined;
    if (isLive && f.status?.elapsed) {
      minute = f.status.elapsed;
    }

    // Scores
    const homeScore = isLive ? (goals?.home ?? 0) : undefined;
    const awayScore = isLive ? (goals?.away ?? 0) : undefined;

    return {
      id: `AF_${f.id}`,
      sport: "football",
      league: league?.name || "Unknown League",
      homeTeam: {
        id: `AF_${teams.home.id}`,
        name: teams.home.name || "Home",
        score: homeScore,
      },
      awayTeam: {
        id: `AF_${teams.away.id}`,
        name: teams.away.name || "Away",
        score: awayScore,
      },
      odds: generateFallbackOdds("football"),
      startTime: f.date || new Date().toISOString(),
      isLive,
      minute,
    };
  } catch (e) {
    console.error("Error parsing AF fixture:", e);
    return null;
  }
}

function parseOddsResponse(data: any): Map<string, { home: number; draw?: number; away: number }> {
  const map = new Map<string, { home: number; draw?: number; away: number }>();
  try {
    const responses = data.response || [];
    for (const item of responses) {
      const fixtureId = String(item.fixture?.id);
      const bookmakers = item.bookmakers || [];
      if (bookmakers.length === 0) continue;

      const bm = bookmakers[0]; // First bookmaker
      const matchWinner = bm.bets?.find((b: any) => b.name === "Match Winner" || b.id === 1);
      if (!matchWinner?.values) continue;

      const homeVal = matchWinner.values.find((v: any) => v.value === "Home");
      const drawVal = matchWinner.values.find((v: any) => v.value === "Draw");
      const awayVal = matchWinner.values.find((v: any) => v.value === "Away");

      if (homeVal && awayVal) {
        map.set(fixtureId, {
          home: parseFloat(homeVal.odd) || 2.0,
          draw: drawVal ? parseFloat(drawVal.odd) : undefined,
          away: parseFloat(awayVal.odd) || 2.0,
        });
      }
    }
  } catch {}
  return map;
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

    // Primary: API-Football via RapidAPI
    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");
    if (rapidApiKey) {
      console.log("Using API-Football (RapidAPI)...");
      allMatches = await fetchAPIFootball(rapidApiKey);
      if (allMatches.length > 0) source = "API-Football";
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
