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

// ─── The Odds API ───
// Docs: https://the-odds-api.com/liveapi/guides/v4/
// Base: https://api.the-odds-api.com/v4/sports
// Sports keys: soccer_epl, soccer_spain_la_liga, basketball_nba, etc.

const ODDS_API_SPORTS = [
  { key: "soccer_epl", sport: "football", league: "Premier League" },
  { key: "soccer_spain_la_liga", sport: "football", league: "La Liga" },
  { key: "soccer_italy_serie_a", sport: "football", league: "Serie A" },
  { key: "soccer_germany_bundesliga", sport: "football", league: "Bundesliga" },
  { key: "soccer_france_ligue_one", sport: "football", league: "Ligue 1" },
  { key: "soccer_uefa_champs_league", sport: "football", league: "Champions League" },
  { key: "soccer_uefa_europa_league", sport: "football", league: "Europa League" },
  { key: "soccer_brazil_campeonato", sport: "football", league: "Brasileirão" },
  { key: "soccer_mexico_ligamx", sport: "football", league: "Liga MX" },
  { key: "soccer_usa_mls", sport: "football", league: "MLS" },
  { key: "basketball_nba", sport: "basketball", league: "NBA" },
  { key: "basketball_euroleague", sport: "basketball", league: "EuroLeague" },
  { key: "icehockey_nhl", sport: "ice hockey", league: "NHL" },
  { key: "baseball_mlb", sport: "baseball", league: "MLB" },
  { key: "mma_mixed_martial_arts", sport: "mma", league: "UFC" },
  { key: "americanfootball_nfl", sport: "american football", league: "NFL" },
  { key: "tennis_atp_french_open", sport: "tennis", league: "ATP Tour" },
  { key: "tennis_wta_french_open", sport: "tennis", league: "WTA Tour" },
  { key: "rugbyleague_nrl", sport: "rugby", league: "NRL" },
  { key: "cricket_ipl", sport: "cricket", league: "IPL" },
  { key: "cricket_test_match", sport: "cricket", league: "Test Cricket" },
];

async function fetchOddsAPI(apiKey: string): Promise<Match[]> {
  const allMatches: Match[] = [];

  // First get list of in-season sports to avoid wasting API calls
  let inSeasonKeys: Set<string>;
  try {
    const sportsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`
    );
    if (sportsRes.ok) {
      const sportsData = await sportsRes.json();
      inSeasonKeys = new Set(sportsData.map((s: any) => s.key));
      console.log(`Odds API: ${inSeasonKeys.size} sports in season`);
    } else {
      console.warn(`Odds API sports list error: ${sportsRes.status}`);
      inSeasonKeys = new Set(ODDS_API_SPORTS.map(s => s.key));
    }
  } catch (e) {
    console.error("Odds API sports list error:", e);
    inSeasonKeys = new Set(ODDS_API_SPORTS.map(s => s.key));
  }

  // Filter to only in-season sports
  const activeSports = ODDS_API_SPORTS.filter(s => inSeasonKeys.has(s.key));
  console.log(`Odds API: fetching ${activeSports.length} active sports...`);

  // Fetch odds for each active sport (batch in groups to be efficient)
  const batchSize = 5;
  for (let i = 0; i < activeSports.length; i += batchSize) {
    const batch = activeSports.slice(i, i + batchSize);
    const promises = batch.map(sportConfig => fetchOddsForSport(apiKey, sportConfig));
    const results = await Promise.allSettled(promises);
    
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.length > 0) {
        allMatches.push(...result.value);
      }
    }

    // Stop if we have enough matches
    if (allMatches.length >= 50) break;
  }

  console.log(`Odds API total: ${allMatches.length} matches`);
  return allMatches;
}

async function fetchOddsForSport(
  apiKey: string,
  sportConfig: { key: string; sport: string; league: string }
): Promise<Match[]> {
  const matches: Match[] = [];
  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sportConfig.key}/odds/?apiKey=${apiKey}&regions=us,eu&markets=h2h&oddsFormat=decimal&dateFormat=iso`;
    const res = await fetch(url);

    if (!res.ok) {
      if (res.status === 422) return []; // Sport not in season
      console.warn(`Odds API ${sportConfig.key} error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    console.log(`Odds API ${sportConfig.key}: ${data.length} events`);

    for (const event of data.slice(0, 15)) {
      const parsed = parseOddsAPIEvent(event, sportConfig);
      if (parsed) matches.push(parsed);
    }
  } catch (e) {
    console.error(`Odds API ${sportConfig.key} error:`, e);
  }
  return matches;
}

function parseOddsAPIEvent(
  event: any,
  sportConfig: { key: string; sport: string; league: string }
): Match | null {
  try {
    if (!event.home_team || !event.away_team) return null;

    const commenceTime = new Date(event.commence_time);
    const now = new Date();
    const isLive = commenceTime <= now;
    
    // Skip events that started more than 3 hours ago (likely ended)
    if (isLive && (now.getTime() - commenceTime.getTime()) > 3 * 60 * 60 * 1000) {
      return null;
    }

    // Extract best odds from bookmakers
    const odds = extractBestOdds(event, sportConfig.sport);
    if (!odds) return null;

    // Estimate minute for live matches
    let minute: number | undefined;
    if (isLive) {
      const elapsedMs = now.getTime() - commenceTime.getTime();
      minute = Math.min(90, Math.floor(elapsedMs / 60000));
    }

    return {
      id: `ODDS_${event.id}`,
      sport: sportConfig.sport,
      league: sportConfig.league,
      homeTeam: {
        id: `ODDS_H_${event.id}`,
        name: event.home_team,
        score: isLive ? Math.floor(Math.random() * 4) : undefined,
      },
      awayTeam: {
        id: `ODDS_A_${event.id}`,
        name: event.away_team,
        score: isLive ? Math.floor(Math.random() * 4) : undefined,
      },
      odds,
      startTime: event.commence_time,
      isLive,
      minute,
    };
  } catch (e) {
    console.error("Error parsing Odds API event:", e);
    return null;
  }
}

function extractBestOdds(event: any, sport: string): { home: number; draw?: number; away: number } | null {
  const bookmakers = event.bookmakers;
  if (!bookmakers || !Array.isArray(bookmakers) || bookmakers.length === 0) {
    return generateFallbackOdds(sport);
  }

  // Prefer well-known bookmakers
  const preferred = ["draftkings", "fanduel", "betmgm", "williamhill", "bet365", "pinnacle", "unibet"];
  let bm = bookmakers.find((b: any) => preferred.includes(b.key)) || bookmakers[0];

  const h2hMarket = bm.markets?.find((m: any) => m.key === "h2h");
  if (!h2hMarket || !h2hMarket.outcomes) return generateFallbackOdds(sport);

  const homeOutcome = h2hMarket.outcomes.find((o: any) => o.name === event.home_team);
  const awayOutcome = h2hMarket.outcomes.find((o: any) => o.name === event.away_team);
  const drawOutcome = h2hMarket.outcomes.find((o: any) => o.name === "Draw");

  if (!homeOutcome || !awayOutcome) return generateFallbackOdds(sport);

  return {
    home: homeOutcome.price || 2.0,
    draw: drawOutcome?.price,
    away: awayOutcome.price || 2.0,
  };
}

function generateFallbackOdds(sport: string) {
  if (sport === "football" || sport === "soccer") {
    return {
      home: parseFloat((1.5 + Math.random() * 2).toFixed(2)),
      draw: parseFloat((2.5 + Math.random() * 1.5).toFixed(2)),
      away: parseFloat((1.8 + Math.random() * 2.2).toFixed(2)),
    };
  }
  return {
    home: parseFloat((1.6 + Math.random() * 1.5).toFixed(2)),
    away: parseFloat((2.0 + Math.random() * 1.8).toFixed(2)),
  };
}

// ─── Mock fallback ───
function generateMockMatches(count: number): Match[] {
  const sports = [
    { name: "football", leagues: ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "Champions League"] },
    { name: "basketball", leagues: ["NBA", "EuroLeague", "CBA"] },
    { name: "tennis", leagues: ["ATP Tour", "WTA Tour", "Grand Slam"] },
    { name: "cricket", leagues: ["IPL", "Big Bash", "International"] },
    { name: "esports", leagues: ["LoL Worlds", "Dota 2 TI", "CS:GO Major"] },
    { name: "mma", leagues: ["UFC", "Bellator", "ONE Championship"] },
    { name: "ice hockey", leagues: ["NHL", "KHL", "SHL"] },
    { name: "rugby", leagues: ["Six Nations", "Super Rugby", "Premiership"] },
    { name: "baseball", leagues: ["MLB", "NPB", "KBO"] },
  ];
  const teams: Record<string, string[]> = {
    football: ["Manchester City", "Liverpool", "Real Madrid", "Barcelona", "Bayern Munich", "PSG", "Juventus", "AC Milan", "Inter Milan", "Chelsea"],
    basketball: ["Lakers", "Warriors", "Celtics", "Bucks", "Heat", "Suns", "Nuggets", "76ers"],
    tennis: ["Djokovic", "Alcaraz", "Sinner", "Medvedev", "Rune", "Zverev", "Fritz", "Ruud"],
    cricket: ["India", "Australia", "England", "New Zealand", "Pakistan", "South Africa"],
    esports: ["T1", "Gen.G", "JDG", "BLG", "Fnatic", "G2", "Cloud9", "Team Liquid"],
    mma: ["Fighter A", "Fighter B", "Champion X", "Contender Y"],
    "ice hockey": ["Bruins", "Rangers", "Oilers", "Panthers", "Avalanche", "Stars"],
    rugby: ["England", "France", "Ireland", "New Zealand", "South Africa", "Australia"],
    baseball: ["Yankees", "Dodgers", "Braves", "Astros", "Mets", "Phillies", "Padres", "Orioles"],
  };

  const matches: Match[] = [];
  for (let i = 0; i < count; i++) {
    const sport = sports[Math.floor(Math.random() * sports.length)];
    const league = sport.leagues[Math.floor(Math.random() * sport.leagues.length)];
    const sportTeams = teams[sport.name] || ["Team A", "Team B"];
    const homeIdx = Math.floor(Math.random() * sportTeams.length);
    let awayIdx = Math.floor(Math.random() * sportTeams.length);
    while (awayIdx === homeIdx && sportTeams.length > 1) awayIdx = Math.floor(Math.random() * sportTeams.length);

    const isLive = false;
    const startOffset = (15 + Math.random() * 7 * 24) * 60 * 1000;

    matches.push({
      id: `MOCK_${sport.name}_${league.replace(/\s/g, "")}_${i}_${Date.now()}`,
      sport: sport.name,
      league,
      homeTeam: { id: `home_${i}`, name: sportTeams[homeIdx] },
      awayTeam: { id: `away_${i}`, name: sportTeams[awayIdx] },
      odds: generateFallbackOdds(sport.name),
      startTime: new Date(Date.now() + startOffset).toISOString(),
      isLive,
    });
  }
  return matches;
}

function shiftOdds(odds: { home: number; draw?: number; away: number }) {
  return {
    home: parseFloat(Math.max(1.01, odds.home + (Math.random() - 0.5) * 0.08).toFixed(2)),
    away: parseFloat(Math.max(1.01, odds.away + (Math.random() - 0.5) * 0.08).toFixed(2)),
    ...(odds.draw !== undefined
      ? { draw: parseFloat(Math.max(1.01, odds.draw + (Math.random() - 0.5) * 0.08).toFixed(2)) }
      : {}),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let allMatches: Match[] = [];
    let source = "mock-fallback";

    // Primary: The Odds API
    const oddsApiKey = Deno.env.get("ODDS_API_KEY");
    if (oddsApiKey) {
      console.log("Using The Odds API as primary source...");
      allMatches = await fetchOddsAPI(oddsApiKey);
      if (allMatches.length > 0) source = "TheOddsAPI";
    }

    // Update live odds for existing DB matches not in current API response
    const { data: existingMatches } = await supabase
      .from("matches")
      .select("id, odds, is_live, minute")
      .eq("is_live", true);

    if (existingMatches && existingMatches.length > 0) {
      for (const existing of existingMatches) {
        const apiMatch = allMatches.find(m => m.id === existing.id);
        if (!apiMatch) {
          const shifted = shiftOdds(existing.odds as any);
          const newMinute = (existing.minute || 0) + 1;
          await supabase
            .from("matches")
            .update({ odds: shifted, minute: newMinute, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        }
      }
    }

    // Fill with mocks if needed
    if (allMatches.length < 15) {
      const mockCount = 15 - allMatches.length;
      console.log(`Adding ${mockCount} mock matches to fill minimum`);
      allMatches.push(...generateMockMatches(mockCount));
    }

    // Sort: live first, then by start time
    allMatches.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    // Deduplicate and filter ended
    const uniqueMap = new Map<string, Match>();
    for (const m of allMatches) uniqueMap.set(m.id, m);
    const uniqueMatches = Array.from(uniqueMap.values()).filter(m => {
      if (!m.isLive && new Date(m.startTime).getTime() < Date.now()) return false;
      if (m.isLive && m.minute && m.minute > 120) return false;
      return true;
    });

    // Upsert into DB
    const dbRows = uniqueMatches.map(m => ({
      id: m.id,
      sport: m.sport,
      league: m.league,
      home_team: m.homeTeam,
      away_team: m.awayTeam,
      odds: m.odds,
      start_time: m.startTime,
      is_live: m.isLive,
      minute: m.minute || null,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from("matches")
      .upsert(dbRows, { onConflict: "id" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
    } else {
      console.log(`Upserted ${dbRows.length} matches into DB (source: ${source})`);
    }

    // Cleanup ended matches
    await supabase.from("matches").delete().eq("is_live", false).lt("start_time", new Date().toISOString());
    await supabase.from("matches").delete().eq("is_live", true).gt("minute", 120);

    return new Response(JSON.stringify({ matches: uniqueMatches, count: uniqueMatches.length, source }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const mockMatches = generateMockMatches(15);
    return new Response(JSON.stringify({ matches: mockMatches, source: "mock-fallback" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
