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
// Docs: https://docs.sportsapipro.com/api-reference/overview
// Auth: x-api-key header
// Response: { games: [...], lastUpdateId, ttl }

const SPORTS_CONFIG = [
  { key: "football", subdomain: "football", sportName: "football" },
  { key: "basketball", subdomain: "basketball", sportName: "basketball" },
  { key: "tennis", subdomain: "tennis", sportName: "tennis" },
  { key: "ice-hockey", subdomain: "icehockey", sportName: "ice hockey" },
  { key: "baseball", subdomain: "baseball", sportName: "baseball" },
  { key: "cricket", subdomain: "cricket", sportName: "cricket" },
  { key: "american-football", subdomain: "american-football", sportName: "american football" },
  { key: "mma", subdomain: "mma", sportName: "mma" },
  { key: "rugby", subdomain: "rugby", sportName: "rugby" },
  { key: "esports", subdomain: "esports", sportName: "esports" },
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
    // options array: each option has num (1=home, 2=draw, 3=away) and rate
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
    // For 2-way sports (basketball, tennis, etc.) options might be num 1 and 2
    const opt1 = options.find((o: any) => o.num === 1);
    const opt2 = options.find((o: any) => o.num === 2);
    if (opt1 && opt2) {
      return {
        home: parseFloat(opt1.rate) || 1.5,
        away: parseFloat(opt2.rate) || 2.0,
      };
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

    // statusGroup: 2=Scheduled, 3=Live, 4=Ended
    const isLive = game.statusGroup === 3;
    const isEnded = game.statusGroup === 4;
    
    // Skip ended games
    if (isEnded) return null;

    // Extract minute from statusText (e.g. "45'" or "HT" or "2H 60'")
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

async function fetchSportsAPIPro(apiKey: string): Promise<Match[]> {
  const allMatches: Match[] = [];
  const today = new Date().toISOString().split("T")[0];

  // Fetch live + today's matches for each sport in parallel
  const fetchPromises = SPORTS_CONFIG.map(async (sport) => {
    const baseUrl = `https://v2.${sport.subdomain}.sportsapipro.com`;
    const headers = { "x-api-key": apiKey };
    const matches: Match[] = [];
    const prefix = sport.key.toUpperCase().replace("-", "");

    // Fetch live matches
    try {
      const liveRes = await fetch(`${baseUrl}/api/live`, { headers });
      if (liveRes.ok) {
        const liveData = await liveRes.json();
        // Debug: log response keys for first sport
        if (sport.key === "football") {
          console.log(`SportsAPI football live response keys: ${JSON.stringify(Object.keys(liveData))}`);
          console.log(`SportsAPI football live sample: ${JSON.stringify(liveData).substring(0, 500)}`);
        }
        const games = liveData.games || liveData.events || [];
        for (const game of games) {
          const parsed = parseGameToMatch(game, sport.sportName, prefix);
          if (parsed) matches.push(parsed);
        }
        console.log(`SportsAPI ${sport.key} live: ${matches.length}`);
      } else {
        const errText = await liveRes.text();
        console.warn(`SportsAPI ${sport.key} live: HTTP ${liveRes.status} - ${errText.substring(0, 200)}`);
      }
    } catch (e) {
      console.error(`SportsAPI ${sport.key} live error:`, e);
    }

    // Fetch today's matches — try /api/today first, fallback to /api/schedule/{date}
    const todayEndpoints = [
      `${baseUrl}/api/today?showOdds=true&timezoneName=UTC`,
      `${baseUrl}/api/schedule/${today}?showOdds=true&timezoneName=UTC`,
    ];

    for (const endpoint of todayEndpoints) {
      try {
        const todayRes = await fetch(endpoint, { headers });
        if (!todayRes.ok) {
          console.warn(`SportsAPI ${sport.key} schedule (${endpoint.includes('/today') ? 'today' : 'date'}): HTTP ${todayRes.status}`);
          continue;
        }
        const todayData = await todayRes.json();
        // Debug: log schedule response for football
        if (sport.key === "football") {
          console.log(`SportsAPI football schedule response keys: ${JSON.stringify(Object.keys(todayData))}`);
          console.log(`SportsAPI football schedule sample: ${JSON.stringify(todayData).substring(0, 500)}`);
        }
        // Parse games from various response formats
        let games: any[] = [];
        if (todayData.games && Array.isArray(todayData.games)) {
          games = todayData.games;
        } else if (todayData.events && Array.isArray(todayData.events)) {
          games = todayData.events;
        } else if (Array.isArray(todayData)) {
          games = todayData;
        } else {
          // Try extracting from nested tournament groups
          const keys = Object.keys(todayData);
          for (const key of keys) {
            const val = todayData[key];
            if (Array.isArray(val)) {
              for (const item of val) {
                if (item.games) games.push(...item.games);
                else if (item.events) games.push(...item.events);
                else if (item.id && (item.homeCompetitor || item.homeTeam)) games.push(item);
              }
            }
          }
        }

        if (games.length > 0) {
          const existingIds = new Set(matches.map(m => m.id));
          let added = 0;
          for (const game of games.slice(0, 30)) {
            const parsed = parseGameToMatch(game, sport.sportName, prefix);
            if (parsed && !existingIds.has(parsed.id)) {
              matches.push(parsed);
              added++;
            }
          }
          console.log(`SportsAPI ${sport.key} schedule: +${added}`);
          break; // Got data, no need to try next endpoint
        }
      } catch (e) {
        console.error(`SportsAPI ${sport.key} schedule error:`, e);
      }
    }

    return matches;
  });

  const results = await Promise.all(fetchPromises);
  for (const sportMatches of results) {
    allMatches.push(...sportMatches);
  }

  console.log(`SportsAPI Pro total: ${allMatches.length} matches across ${SPORTS_CONFIG.length} sports`);
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
    const startOffset = isLive ? 0 : Math.random() * 7 * 24 * 60 * 60 * 1000;

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

    // Check existing DB matches to update live odds
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
    const uniqueMatches = Array.from(uniqueMap.values());

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

    // Auto-remove ended matches
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

    const { data: deletedPast, error: delPastErr } = await supabase
      .from("matches")
      .delete()
      .eq("is_live", false)
      .lt("start_time", threeMinutesAgo)
      .select("id");

    if (delPastErr) {
      console.error("Error deleting past matches:", delPastErr);
    } else if (deletedPast && deletedPast.length > 0) {
      console.log(`Removed ${deletedPast.length} ended (past) matches`);
    }

    const { data: deletedEnded, error: delEndedErr } = await supabase
      .from("matches")
      .delete()
      .eq("is_live", true)
      .gt("minute", 120)
      .select("id");

    if (delEndedErr) {
      console.error("Error deleting ended live matches:", delEndedErr);
    } else if (deletedEnded && deletedEnded.length > 0) {
      console.log(`Removed ${deletedEnded.length} ended (overtime) live matches`);
    }

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
