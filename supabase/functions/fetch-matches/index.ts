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

// ─── SportsAPI Pro V2 ───
// Auth: x-api-key header | Base: https://v2.{sport}.sportsapipro.com
// Endpoints: /api/live (live matches), /api/today (today's schedule)
// Response: { games: [...], lastUpdateId, ttl }
// statusGroup: 2=Scheduled, 3=Live, 4=Ended

// Primary sports only to conserve API quota (100 req/day on free tier)
// Each invocation: 2 calls per sport (live + today) = ~6-8 calls
const PRIMARY_SPORTS = [
  { subdomain: "football", sportName: "football", prefix: "FB" },
  { subdomain: "basketball", sportName: "basketball", prefix: "BB" },
  { subdomain: "tennis", sportName: "tennis", prefix: "TN" },
];

// Secondary sports rotate: one per invocation to save quota
const SECONDARY_SPORTS = [
  { subdomain: "cricket", sportName: "cricket", prefix: "CK" },
  { subdomain: "mma", sportName: "mma", prefix: "MMA" },
  { subdomain: "baseball", sportName: "baseball", prefix: "BL" },
  { subdomain: "rugby", sportName: "rugby", prefix: "RG" },
  { subdomain: "american-football", sportName: "american football", prefix: "AF" },
  { subdomain: "esports", sportName: "esports", prefix: "ES" },
];

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

function parseOdds(game: any, sportName: string): { home: number; draw?: number; away: number } {
  try {
    const oddsData = game.odds;
    if (!oddsData || !oddsData.options || !Array.isArray(oddsData.options)) {
      return generateFallbackOdds(sportName);
    }
    const options = oddsData.options;
    const homeOpt = options.find((o: any) => o.num === 1);
    const drawOpt = options.find((o: any) => o.num === 2);
    const awayOpt = options.find((o: any) => o.num === 3);

    if (homeOpt && awayOpt) {
      return {
        home: parseFloat(homeOpt.rate) || generateFallbackOdds(sportName).home,
        ...(drawOpt ? { draw: parseFloat(drawOpt.rate) } : {}),
        away: parseFloat(awayOpt.rate) || generateFallbackOdds(sportName).away,
      };
    }
    const opt1 = options.find((o: any) => o.num === 1);
    const opt2 = options.find((o: any) => o.num === 2);
    if (opt1 && opt2) {
      return { home: parseFloat(opt1.rate) || 1.5, away: parseFloat(opt2.rate) || 2.0 };
    }
    return generateFallbackOdds(sportName);
  } catch {
    return generateFallbackOdds(sportName);
  }
}

function parseGameToMatch(game: any, sportName: string, prefix: string): Match | null {
  try {
    const home = game.homeCompetitor;
    const away = game.awayCompetitor;
    if (!home || !away) return null;

    const isLive = game.statusGroup === 3;
    const isEnded = game.statusGroup === 4;
    if (isEnded) return null;

    let minute: number | undefined;
    if (isLive && game.statusText) {
      const minuteMatch = game.statusText.match(/(\d+)/);
      if (minuteMatch) minute = parseInt(minuteMatch[1]);
    }

    const league = game.competitionDisplayName || game.competition?.name || "Unknown League";

    return {
      id: `${prefix}_${game.id}`,
      sport: sportName,
      league,
      homeTeam: {
        id: `${prefix}_${home.id}`,
        name: home.name || "Home",
        score: home.score !== undefined && home.score !== null ? home.score : undefined,
      },
      awayTeam: {
        id: `${prefix}_${away.id}`,
        name: away.name || "Away",
        score: away.score !== undefined && away.score !== null ? away.score : undefined,
      },
      odds: parseOdds(game, sportName),
      startTime: game.startTime || new Date().toISOString(),
      isLive,
      minute,
    };
  } catch (e) {
    console.error(`Error parsing ${prefix} game:`, e);
    return null;
  }
}

async function fetchSportData(
  baseUrl: string,
  sportName: string,
  prefix: string,
  apiKey: string,
): Promise<Match[]> {
  const headers = { "x-api-key": apiKey };
  const matches: Match[] = [];

  // Fetch live
  try {
    const res = await fetch(`${baseUrl}/api/live`, { headers });
    if (res.ok) {
      const data = await res.json();
      const games = data.games || data.events || [];
      for (const game of games) {
        const parsed = parseGameToMatch(game, sportName, prefix);
        if (parsed) matches.push(parsed);
      }
    } else if (res.status === 429) {
      console.warn(`Rate limited on ${sportName} live`);
      return matches;
    }
  } catch (e) {
    console.error(`${sportName} live error:`, e);
  }

  // Fetch today's schedule
  try {
    const res = await fetch(`${baseUrl}/api/today?showOdds=true&timezoneName=UTC`, { headers });
    if (res.ok) {
      const data = await res.json();
      let games: any[] = data.games || data.events || [];
      if (games.length === 0 && !Array.isArray(data)) {
        // Try nested tournament groups
        for (const key of Object.keys(data)) {
          const val = data[key];
          if (Array.isArray(val)) {
            for (const item of val) {
              if (item.games) games.push(...item.games);
              else if (item.events) games.push(...item.events);
              else if (item.id && item.homeCompetitor) games.push(item);
            }
          }
        }
      }
      const existingIds = new Set(matches.map(m => m.id));
      for (const game of games.slice(0, 30)) {
        const parsed = parseGameToMatch(game, sportName, prefix);
        if (parsed && !existingIds.has(parsed.id)) matches.push(parsed);
      }
    }
  } catch (e) {
    console.error(`${sportName} schedule error:`, e);
  }

  console.log(`SportsAPI ${sportName}: ${matches.length} matches`);
  return matches;
}

async function fetchSportsAPIPro(apiKey: string): Promise<Match[]> {
  // Determine which secondary sport to fetch this round (rotate by minute)
  const rotationIndex = Math.floor(Date.now() / 60000) % SECONDARY_SPORTS.length;
  const secondarySport = SECONDARY_SPORTS[rotationIndex];

  const sportsToFetch = [
    ...PRIMARY_SPORTS,
    secondarySport,
  ];

  const results = await Promise.all(
    sportsToFetch.map(s =>
      fetchSportData(`https://v2.${s.subdomain}.sportsapipro.com`, s.sportName, s.prefix, apiKey)
    )
  );

  const allMatches = results.flat();
  console.log(`SportsAPI Pro total: ${allMatches.length} (primary: ${PRIMARY_SPORTS.length}, secondary: ${secondarySport.sportName})`);
  return allMatches;
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

    const isLive = Math.random() > 0.6;
    const startOffset = isLive ? 0 : (15 + Math.random() * 7 * 24) * 60 * 1000; // Always in the future

    matches.push({
      id: `MOCK_${sport.name}_${league.replace(/\s/g, "")}_${i}`,
      sport: sport.name,
      league,
      homeTeam: { id: `home_${i}`, name: sportTeams[homeIdx], score: isLive ? Math.floor(Math.random() * 5) : undefined },
      awayTeam: { id: `away_${i}`, name: sportTeams[awayIdx], score: isLive ? Math.floor(Math.random() * 5) : undefined },
      odds: generateFallbackOdds(sport.name),
      startTime: new Date(Date.now() + startOffset).toISOString(),
      isLive,
      minute: isLive ? Math.floor(Math.random() * 90) : undefined,
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

    const apiKey = Deno.env.get("SPORTSAPI_PRO_KEY");
    let allMatches: Match[] = [];

    if (apiKey) {
      allMatches = await fetchSportsAPIPro(apiKey);
    } else {
      console.warn("SPORTSAPI_PRO_KEY not set — using mock data only");
    }

    // Update live odds for DB matches not in current API response
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
    if (allMatches.length < 25) {
      allMatches.push(...generateMockMatches(25 - allMatches.length));
    }

    // Sort: live first, then by start time
    allMatches.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    // Deduplicate by ID
    const uniqueMap = new Map<string, Match>();
    for (const m of allMatches) uniqueMap.set(m.id, m);
    const uniqueMatches = Array.from(uniqueMap.values()).filter(m => {
      // Remove ended: non-live matches whose start time has passed, or live matches past 90 min
      if (!m.isLive && new Date(m.startTime).getTime() < Date.now()) return false;
      if (m.isLive && m.minute && m.minute > 90) return false;
      return true;
    });

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
      console.log(`Upserted ${dbRows.length} matches into DB`);
    }

    // Auto-remove ended matches immediately
    await supabase.from("matches").delete().eq("is_live", false).lt("start_time", new Date().toISOString());
    await supabase.from("matches").delete().eq("is_live", true).gt("minute", 90);

    return new Response(JSON.stringify({ matches: allMatches, count: allMatches.length, source: "SportsAPI Pro" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const mockMatches = generateMockMatches(25);
    return new Response(JSON.stringify({ matches: mockMatches, source: "mock-fallback" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
