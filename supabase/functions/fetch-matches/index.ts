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

// ─── Sport config for SportsAPI Pro V2 ───
const SPORTS_CONFIG = [
  { key: "football", subdomain: "football", hasDraw: true },
  { key: "basketball", subdomain: "basketball", hasDraw: false },
  { key: "tennis", subdomain: "tennis", hasDraw: false },
  { key: "ice hockey", subdomain: "hockey", hasDraw: false },
  { key: "cricket", subdomain: "cricket", hasDraw: false },
  { key: "mma", subdomain: "mma", hasDraw: false },
  { key: "rugby", subdomain: "rugby", hasDraw: true },
  { key: "american football", subdomain: "american-football", hasDraw: false },
  { key: "baseball", subdomain: "baseball", hasDraw: false },
  { key: "esports", subdomain: "esports", hasDraw: false },
];

function generateOdds(hasDraw: boolean) {
  if (hasDraw) {
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

// ─── Parse SportsAPI Pro V2 game response ───
function parseGame(game: any, sportKey: string, hasDraw: boolean): Match | null {
  try {
    const home = game.homeCompetitor || game.homeTeam;
    const away = game.awayCompetitor || game.awayTeam;
    if (!home || !away) return null;

    const homeName = home.name || home.longName || home.shortName || "Home";
    const awayName = away.name || away.longName || away.shortName || "Away";

    // Determine live status
    const statusId = game.statusId || game.status?.id;
    const statusType = game.statusType || game.status?.type;
    // statusType 2 = inprogress in SportsAPI Pro
    const isLive = statusType === 2 || statusType === "inprogress" || game.isLive === true;

    // Scores
    const homeScore = home.score ?? game.homeScore ?? undefined;
    const awayScore = away.score ?? game.awayScore ?? undefined;

    // Minute / game clock
    const minute = game.gameTime ?? game.gameTimeDisplay ?? game.statusText ?? undefined;
    const minuteNum = typeof minute === "number" ? minute : (typeof minute === "string" ? parseInt(minute) || undefined : undefined);

    // League / competition
    const league = game.competitionDisplayName || game.competition?.name || game.tournamentName || game.league?.name || `${sportKey} League`;

    // Odds
    let odds = generateOdds(hasDraw);
    if (game.odds) {
      // SportsAPI Pro may return odds in various formats
      const o = game.odds;
      if (o.home && o.away) {
        odds = {
          home: parseFloat(o.home) || odds.home,
          away: parseFloat(o.away) || odds.away,
          ...(o.draw ? { draw: parseFloat(o.draw) } : hasDraw ? { draw: odds.draw } : {}),
        };
      } else if (Array.isArray(o) && o.length >= 2) {
        odds = {
          home: parseFloat(o[0].value || o[0].price) || odds.home,
          away: parseFloat(o[1].value || o[1].price) || odds.away,
          ...(o[2] ? { draw: parseFloat(o[2].value || o[2].price) } : hasDraw ? { draw: odds.draw } : {}),
        };
      }
    }

    return {
      id: `SAP_${sportKey}_${game.id}`,
      sport: sportKey,
      league,
      homeTeam: {
        id: `sap_${home.id || game.id}_h`,
        name: homeName,
        score: typeof homeScore === "number" ? homeScore : undefined,
      },
      awayTeam: {
        id: `sap_${away.id || game.id}_a`,
        name: awayName,
        score: typeof awayScore === "number" ? awayScore : undefined,
      },
      odds,
      startTime: game.startTime || game.startDate || new Date().toISOString(),
      isLive,
      minute: minuteNum,
    };
  } catch (e) {
    console.error(`Error parsing ${sportKey} game:`, e);
    return null;
  }
}

// ─── Fetch live matches from SportsAPI Pro V2 ───
async function fetchSportsAPIPro(apiKey: string): Promise<Match[]> {
  const allMatches: Match[] = [];

  // Fetch all sports concurrently
  const fetches = SPORTS_CONFIG.map(async (sport) => {
    const baseUrl = `https://v2.${sport.subdomain}.sportsapipro.com`;
    const headers = { "x-api-key": apiKey };
    const matches: Match[] = [];

    // Fetch live games
    try {
      const liveRes = await fetch(`${baseUrl}/api/live`, { headers });
      if (liveRes.ok) {
        const liveData = await liveRes.json();
        const games = liveData.games || liveData.events || liveData.data || [];
        if (Array.isArray(games)) {
          for (const game of games) {
            const parsed = parseGame(game, sport.key, sport.hasDraw);
            if (parsed) matches.push(parsed);
          }
        }
        console.log(`SportsAPI Pro ${sport.key} live: ${matches.length}`);
      } else {
        console.warn(`SportsAPI Pro ${sport.key} live: ${liveRes.status}`);
      }
    } catch (e) {
      console.error(`SportsAPI Pro ${sport.key} live error:`, e);
    }

    // Fetch today's schedule (upcoming)
    try {
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "/");
      const schedRes = await fetch(`${baseUrl}/api/schedule/${today}`, { headers });
      if (schedRes.ok) {
        const schedData = await schedRes.json();
        const games = schedData.games || schedData.events || schedData.data || [];
        const existingIds = new Set(matches.map(m => m.id));
        if (Array.isArray(games)) {
          for (const game of games) {
            const parsed = parseGame(game, sport.key, sport.hasDraw);
            if (parsed && !existingIds.has(parsed.id)) matches.push(parsed);
          }
        }
        console.log(`SportsAPI Pro ${sport.key} total: ${matches.length}`);
      }
    } catch (e) {
      console.error(`SportsAPI Pro ${sport.key} schedule error:`, e);
    }

    return matches;
  });

  const results = await Promise.all(fetches);
  for (const matches of results) {
    allMatches.push(...matches);
  }

  console.log(`SportsAPI Pro grand total: ${allMatches.length} matches`);
  return allMatches;
}

// ─── Fetch football odds from V2 ───
async function fetchFootballOdds(apiKey: string, matches: Match[]): Promise<void> {
  try {
    const res = await fetch("https://v2.football.sportsapipro.com/api/odds/featured", {
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) return;
    const data = await res.json();
    const events = data.events || data.games || data.data || [];
    if (!Array.isArray(events)) return;

    for (const event of events) {
      const homeN = (event.homeCompetitor?.name || event.homeTeam?.name || "").toLowerCase().trim();
      const awayN = (event.awayCompetitor?.name || event.awayTeam?.name || "").toLowerCase().trim();
      if (!homeN || !awayN) continue;

      const match = matches.find(m =>
        m.homeTeam.name.toLowerCase().trim() === homeN &&
        m.awayTeam.name.toLowerCase().trim() === awayN
      );
      if (!match) continue;

      const odds = event.odds;
      if (odds) {
        if (odds.home && odds.away) {
          match.odds = {
            home: parseFloat(odds.home),
            away: parseFloat(odds.away),
            ...(odds.draw ? { draw: parseFloat(odds.draw) } : {}),
          };
        }
      }
    }
    console.log("Football odds overlay applied");
  } catch (e) {
    console.error("Football odds error:", e);
  }
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
    const hasDraw = sport.name === "football" || sport.name === "rugby";

    matches.push({
      id: `MOCK_${sport.name}_${league.replace(/\s/g, "")}_${i}`,
      sport: sport.name,
      league,
      homeTeam: { id: `home_${i}`, name: sportTeams[homeIdx], score: isLive ? Math.floor(Math.random() * 5) : undefined },
      awayTeam: { id: `away_${i}`, name: sportTeams[awayIdx], score: isLive ? Math.floor(Math.random() * 5) : undefined },
      odds: generateOdds(hasDraw),
      startTime: new Date(Date.now() + startOffset).toISOString(),
      isLive,
      minute: isLive ? Math.floor(Math.random() * 90) : undefined,
    });
  }
  return matches;
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
      // Fetch from SportsAPI Pro
      allMatches = await fetchSportsAPIPro(apiKey);

      // Try to overlay real odds for football
      if (allMatches.some(m => m.sport === "football")) {
        await fetchFootballOdds(apiKey, allMatches);
      }
    } else {
      console.warn("SPORTSAPI_PRO_KEY not set, using mock data only");
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

    // Upsert into DB for realtime
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

    const { data: deletedPast } = await supabase
      .from("matches")
      .delete()
      .eq("is_live", false)
      .lt("start_time", threeMinutesAgo)
      .select("id");

    if (deletedPast && deletedPast.length > 0) {
      console.log(`Removed ${deletedPast.length} ended (past) matches`);
    }

    const { data: deletedEnded } = await supabase
      .from("matches")
      .delete()
      .eq("is_live", true)
      .gt("minute", 120)
      .select("id");

    if (deletedEnded && deletedEnded.length > 0) {
      console.log(`Removed ${deletedEnded.length} ended (overtime) live matches`);
    }

    return new Response(JSON.stringify({ matches: uniqueMatches, count: uniqueMatches.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const mockMatches = generateMockMatches(25);
    return new Response(JSON.stringify({ matches: mockMatches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
