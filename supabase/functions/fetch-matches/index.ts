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

function generateOdds(sport: string) {
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

function shiftOdds(odds: { home: number; draw?: number; away: number }) {
  return {
    home: parseFloat(Math.max(1.01, odds.home + (Math.random() - 0.5) * 0.08).toFixed(2)),
    away: parseFloat(Math.max(1.01, odds.away + (Math.random() - 0.5) * 0.08).toFixed(2)),
    ...(odds.draw !== undefined
      ? { draw: parseFloat(Math.max(1.01, odds.draw + (Math.random() - 0.5) * 0.08).toFixed(2)) }
      : {}),
  };
}

// ─── SportMonks Football API v3 (Live Scores + Real Odds) ───
async function fetchSportMonks(): Promise<Match[]> {
  const apiToken = Deno.env.get("SPORTMONKS_API_KEY");
  if (!apiToken) {
    console.warn("SPORTMONKS_API_KEY not set, skipping SportMonks");
    return [];
  }

  const matches: Match[] = [];

  try {
    // Fetch livescores with scores, participants, odds includes
    const liveRes = await fetch(
      `https://api.sportmonks.com/v3/football/livescores/inplay?api_token=${apiToken}&include=participants;scores;odds`
    );
    const liveData = await liveRes.json();

    if (liveData.data && Array.isArray(liveData.data)) {
      for (const fixture of liveData.data) {
        const parsed = parseSportMonksFixture(fixture, true);
        if (parsed) matches.push(parsed);
      }
    }
    console.log(`SportMonks live: ${matches.length} matches`);
  } catch (e) {
    console.error("SportMonks livescores error:", e);
  }

  try {
    // Fetch today's fixtures (scheduled/upcoming) with odds
    const today = new Date().toISOString().split("T")[0];
    const fixturesRes = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/date/${today}?api_token=${apiToken}&include=participants;scores;odds;league&per_page=50`
    );
    const fixturesData = await fixturesRes.json();

    if (fixturesData.data && Array.isArray(fixturesData.data)) {
      const existingIds = new Set(matches.map(m => m.id));
      for (const fixture of fixturesData.data) {
        const parsed = parseSportMonksFixture(fixture, false);
        if (parsed && !existingIds.has(parsed.id)) matches.push(parsed);
      }
    }
    console.log(`SportMonks total (live+scheduled): ${matches.length} matches`);
  } catch (e) {
    console.error("SportMonks fixtures error:", e);
  }

  return matches;
}

function parseSportMonksFixture(fixture: any, isLive: boolean): Match | null {
  try {
    const participants = fixture.participants || [];
    const home = participants.find((p: any) => p.meta?.location === "home");
    const away = participants.find((p: any) => p.meta?.location === "away");
    if (!home || !away) return null;

    // Extract scores
    const scores = fixture.scores || [];
    const homeScore = scores.find((s: any) => s.description === "CURRENT" && s.score?.participant === "home");
    const awayScore = scores.find((s: any) => s.description === "CURRENT" && s.score?.participant === "away");

    // Extract odds (market_id 1 = Match Winner: Home/Draw/Away)
    let odds = generateOdds("football");
    const oddsData = fixture.odds || [];
    const matchWinnerOdds = oddsData.filter((o: any) => o.market_id === 1);
    if (matchWinnerOdds.length >= 2) {
      const homeOdd = matchWinnerOdds.find((o: any) => o.label === "Home" || o.name === "Home");
      const drawOdd = matchWinnerOdds.find((o: any) => o.label === "Draw" || o.name === "Draw");
      const awayOdd = matchWinnerOdds.find((o: any) => o.label === "Away" || o.name === "Away");
      odds = {
        home: homeOdd ? parseFloat(homeOdd.value) : odds.home,
        draw: drawOdd ? parseFloat(drawOdd.value) : odds.draw,
        away: awayOdd ? parseFloat(awayOdd.value) : odds.away,
      };
    }

    // Determine live state from state_id (1=NS, 2=1H, 3=HT, 4=2H, 5=FT, etc.)
    const liveStates = [2, 3, 4, 21, 22, 23, 24, 25]; // various in-play states
    const fixtureIsLive = isLive || liveStates.includes(fixture.state_id);

    // Minute from clock or time info
    const minute = fixture.clock?.minute ?? fixture.time?.minute ?? undefined;

    const leagueName = fixture.league?.name || fixture.name?.split(" vs ")?.[0] || "Football League";

    return {
      id: `SM_${fixture.id}`,
      sport: "football",
      league: leagueName,
      homeTeam: {
        id: `sm_${home.id}`,
        name: home.name || "Home",
        score: homeScore?.score?.goals ?? undefined,
      },
      awayTeam: {
        id: `sm_${away.id}`,
        name: away.name || "Away",
        score: awayScore?.score?.goals ?? undefined,
      },
      odds,
      startTime: fixture.starting_at || new Date().toISOString(),
      isLive: fixtureIsLive,
      minute,
    };
  } catch (e) {
    console.error("Error parsing SportMonks fixture:", e);
    return null;
  }
}

// ─── The Odds API (Real bookmaker odds overlay) ───
interface OddsAPIEvent {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: Array<{
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number }>;
    }>;
  }>;
}

async function fetchOddsAPI(): Promise<Map<string, { home: number; draw?: number; away: number }>> {
  const apiKey = Deno.env.get("ODDS_API_KEY");
  if (!apiKey) {
    console.warn("ODDS_API_KEY not set, skipping The Odds API");
    return new Map();
  }

  const oddsMap = new Map<string, { home: number; draw?: number; away: number }>();
  const sports = ["soccer", "basketball", "icehockey", "baseball", "mma_mixed_martial_arts", "americanfootball", "rugbyleague", "tennis"];

  for (const sport of sports) {
    try {
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/${sport === "soccer" ? "soccer_epl" : sport === "basketball" ? "basketball_nba" : sport === "icehockey" ? "icehockey_nhl" : sport === "baseball" ? "baseball_mlb" : sport}/odds/?apiKey=${apiKey}&regions=us,eu&markets=h2h&oddsFormat=decimal`
      );
      if (!res.ok) {
        console.warn(`Odds API ${sport} returned ${res.status}`);
        continue;
      }
      const events: OddsAPIEvent[] = await res.json();

      for (const event of events) {
        const bookmaker = event.bookmakers?.[0];
        const h2h = bookmaker?.markets?.find((m: any) => m.key === "h2h");
        if (!h2h) continue;

        const homeOutcome = h2h.outcomes.find((o: any) => o.name === event.home_team);
        const awayOutcome = h2h.outcomes.find((o: any) => o.name === event.away_team);
        const drawOutcome = h2h.outcomes.find((o: any) => o.name === "Draw");

        if (homeOutcome && awayOutcome) {
          // Key by normalized team names for matching
          const key = `${event.home_team.toLowerCase().trim()}|${event.away_team.toLowerCase().trim()}`;
          oddsMap.set(key, {
            home: homeOutcome.price,
            away: awayOutcome.price,
            ...(drawOutcome ? { draw: drawOutcome.price } : {}),
          });
        }
      }
      console.log(`Odds API ${sport}: ${events.length} events`);
    } catch (e) {
      console.error(`Odds API ${sport} error:`, e);
    }
  }

  console.log(`Odds API total: ${oddsMap.size} odds entries`);
  return oddsMap;
}

// ─── TheSportsDB (Soccer, Basketball, Tennis, Cricket, Rugby, etc.) ───
async function fetchTheSportsDB(): Promise<Match[]> {
  const matches: Match[] = [];
  const sports = ["Soccer", "Basketball", "Tennis", "Cricket", "Rugby", "American_Football", "Ice_Hockey"];

  for (const sport of sports) {
    try {
      const response = await fetch(
        `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${new Date().toISOString().split("T")[0]}&s=${sport}`
      );
      const data = await response.json();

      if (data.events) {
        for (const event of data.events.slice(0, 5)) {
          matches.push({
            id: `TSD_${event.idEvent}`,
            sport: sport.toLowerCase().replace("_", " "),
            league: event.strLeague || "Unknown League",
            homeTeam: {
              id: event.idHomeTeam || `home_${event.idEvent}`,
              name: event.strHomeTeam || "Home Team",
              score: event.intHomeScore ? parseInt(event.intHomeScore) : undefined,
            },
            awayTeam: {
              id: event.idAwayTeam || `away_${event.idEvent}`,
              name: event.strAwayTeam || "Away Team",
              score: event.intAwayScore ? parseInt(event.intAwayScore) : undefined,
            },
            odds: generateOdds(sport.toLowerCase()),
            startTime: event.strTimestamp || new Date().toISOString(),
            isLive: event.strStatus === "Live" || event.strStatus === "1H" || event.strStatus === "2H",
            minute: event.strProgress ? parseInt(event.strProgress) : undefined,
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching TheSportsDB ${sport}:`, error);
    }
  }
  return matches;
}

// ─── NBA (Official CDN) ───
async function fetchNBA(): Promise<Match[]> {
  try {
    const response = await fetch(
      "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json"
    );
    const data = await response.json();
    return data.scoreboard.games.map((game: any) => ({
      id: `NBA_${game.gameId}`,
      sport: "basketball",
      league: "NBA",
      homeTeam: { id: game.homeTeam.teamId.toString(), name: game.homeTeam.teamName, score: game.homeTeam.score },
      awayTeam: { id: game.awayTeam.teamId.toString(), name: game.awayTeam.teamName, score: game.awayTeam.score },
      odds: generateOdds("basketball"),
      startTime: game.gameTimeUTC,
      isLive: game.gameStatus === 2,
      minute: game.gameClock ? parseInt(game.gameClock) : undefined,
    }));
  } catch (error) {
    console.error("Error fetching NBA:", error);
    return [];
  }
}

// ─── MLB (Official Stats API – free, no key) ───
async function fetchMLB(): Promise<Match[]> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?date=${today}&sportId=1&hydrate=linescore,team`
    );
    const data = await response.json();

    const matches: Match[] = [];
    for (const date of data.dates || []) {
      for (const game of date.games || []) {
        const statusCode = game.status?.statusCode || "";
        const isLive = statusCode === "I" || statusCode === "MA" || statusCode === "MC";
        const linescore = game.linescore;

        matches.push({
          id: `MLB_${game.gamePk}`,
          sport: "baseball",
          league: "MLB",
          homeTeam: {
            id: game.teams.home.team.id.toString(),
            name: game.teams.home.team.name,
            score: linescore?.teams?.home?.runs,
          },
          awayTeam: {
            id: game.teams.away.team.id.toString(),
            name: game.teams.away.team.name,
            score: linescore?.teams?.away?.runs,
          },
          odds: generateOdds("baseball"),
          startTime: game.gameDate || new Date().toISOString(),
          isLive,
          minute: linescore?.currentInning,
        });
      }
    }
    return matches;
  } catch (error) {
    console.error("Error fetching MLB:", error);
    return [];
  }
}

// ─── NHL (Official Stats API – free, no key) ───
async function fetchNHL(): Promise<Match[]> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const response = await fetch(
      `https://api-web.nhle.com/v1/schedule/${today}`
    );
    const data = await response.json();

    const matches: Match[] = [];
    for (const week of data.gameWeek || []) {
      for (const game of week.games || []) {
        const state = game.gameState || "";
        const isLive = state === "LIVE" || state === "CRIT";

        matches.push({
          id: `NHL_${game.id}`,
          sport: "ice hockey",
          league: "NHL",
          homeTeam: {
            id: game.homeTeam?.id?.toString() || `nhl_h_${game.id}`,
            name: game.homeTeam?.placeName?.default
              ? `${game.homeTeam.placeName.default} ${game.homeTeam.commonName?.default || ""}`
              : "Home",
            score: game.homeTeam?.score,
          },
          awayTeam: {
            id: game.awayTeam?.id?.toString() || `nhl_a_${game.id}`,
            name: game.awayTeam?.placeName?.default
              ? `${game.awayTeam.placeName.default} ${game.awayTeam.commonName?.default || ""}`
              : "Away",
            score: game.awayTeam?.score,
          },
          odds: generateOdds("ice hockey"),
          startTime: game.startTimeUTC || new Date().toISOString(),
          isLive,
          minute: game.periodDescriptor?.number,
        });
      }
    }
    return matches;
  } catch (error) {
    console.error("Error fetching NHL:", error);
    return [];
  }
}

// ─── ESPN (Unofficial public API – soccer leagues) ───
async function fetchESPNSoccer(): Promise<Match[]> {
  const leagues = [
    { slug: "eng.1", name: "Premier League" },
    { slug: "esp.1", name: "La Liga" },
    { slug: "ger.1", name: "Bundesliga" },
    { slug: "ita.1", name: "Serie A" },
    { slug: "fra.1", name: "Ligue 1" },
    { slug: "uefa.champions", name: "Champions League" },
  ];

  const matches: Match[] = [];

  for (const league of leagues) {
    try {
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.slug}/scoreboard`
      );
      const data = await response.json();

      for (const event of (data.events || []).slice(0, 4)) {
        const comp = event.competitions?.[0];
        if (!comp) continue;

        const home = comp.competitors?.find((c: any) => c.homeAway === "home");
        const away = comp.competitors?.find((c: any) => c.homeAway === "away");
        if (!home || !away) continue;

        const statusType = comp.status?.type?.name || "";
        const isLive = statusType === "STATUS_IN_PROGRESS" || statusType === "STATUS_HALFTIME";

        matches.push({
          id: `ESPN_${event.id}`,
          sport: "football",
          league: league.name,
          homeTeam: {
            id: home.team?.id || `espn_h_${event.id}`,
            name: home.team?.displayName || "Home",
            score: home.score ? parseInt(home.score) : undefined,
          },
          awayTeam: {
            id: away.team?.id || `espn_a_${event.id}`,
            name: away.team?.displayName || "Away",
            score: away.score ? parseInt(away.score) : undefined,
          },
          odds: generateOdds("football"),
          startTime: event.date || new Date().toISOString(),
          isLive,
          minute: comp.status?.displayClock ? parseInt(comp.status.displayClock) : undefined,
        });
      }
    } catch (error) {
      console.error(`Error fetching ESPN ${league.name}:`, error);
    }
  }
  return matches;
}

// ─── ESPN MMA/UFC ───
async function fetchESPNMMA(): Promise<Match[]> {
  try {
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard`
    );
    const data = await response.json();
    const matches: Match[] = [];

    for (const event of (data.events || []).slice(0, 6)) {
      const comp = event.competitions?.[0];
      if (!comp) continue;
      const fighters = comp.competitors || [];
      if (fighters.length < 2) continue;

      const isLive = comp.status?.type?.name === "STATUS_IN_PROGRESS";

      matches.push({
        id: `ESPN_MMA_${event.id}`,
        sport: "mma",
        league: "UFC",
        homeTeam: {
          id: fighters[0].id || `mma_h_${event.id}`,
          name: fighters[0].athlete?.displayName || "Fighter A",
          score: undefined,
        },
        awayTeam: {
          id: fighters[1].id || `mma_a_${event.id}`,
          name: fighters[1].athlete?.displayName || "Fighter B",
          score: undefined,
        },
        odds: generateOdds("mma"),
        startTime: event.date || new Date().toISOString(),
        isLive,
      });
    }
    return matches;
  } catch (error) {
    console.error("Error fetching ESPN MMA:", error);
    return [];
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

    matches.push({
      id: `MOCK_${sport.name}_${league.replace(/\s/g, '')}_${i}`,
      sport: sport.name,
      league,
      homeTeam: { id: `home_${i}`, name: sportTeams[homeIdx], score: isLive ? Math.floor(Math.random() * 5) : undefined },
      awayTeam: { id: `away_${i}`, name: sportTeams[awayIdx], score: isLive ? Math.floor(Math.random() * 5) : undefined },
      odds: generateOdds(sport.name),
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

    // Fetch from all APIs in parallel (including real odds)
    const [sportMonksMatches, sportsDbMatches, nbaMatches, mlbMatches, nhlMatches, espnSoccerMatches, espnMmaMatches, realOddsMap] = await Promise.all([
      fetchSportMonks(),
      fetchTheSportsDB(),
      fetchNBA(),
      fetchMLB(),
      fetchNHL(),
      fetchESPNSoccer(),
      fetchESPNMMA(),
      fetchOddsAPI(),
    ]);

    const allMatches: Match[] = [
      ...sportMonksMatches,
      ...sportsDbMatches,
      ...nbaMatches,
      ...mlbMatches,
      ...nhlMatches,
      ...espnSoccerMatches,
      ...espnMmaMatches,
    ];

    // Overlay real odds from The Odds API onto matches
    let oddsOverlayCount = 0;
    for (const match of allMatches) {
      const key = `${match.homeTeam.name.toLowerCase().trim()}|${match.awayTeam.name.toLowerCase().trim()}`;
      const realOdds = realOddsMap.get(key);
      if (realOdds) {
        match.odds = realOdds;
        oddsOverlayCount++;
      }
    }

    console.log(`Fetched ${allMatches.length} matches (SportMonks: ${sportMonksMatches.length}, TheSportsDB: ${sportsDbMatches.length}, NBA: ${nbaMatches.length}, MLB: ${mlbMatches.length}, NHL: ${nhlMatches.length}, ESPN Soccer: ${espnSoccerMatches.length}, ESPN MMA: ${espnMmaMatches.length}). Real odds applied to ${oddsOverlayCount} matches.`);

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

    // ─── Auto-remove ended matches ───
    // Remove non-live matches whose start_time is more than 3 minutes ago
    // and live matches whose minute exceeds 120 (full time + extra time buffer)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    
    // Delete old non-live matches (finished/past)
    const { data: deletedPast, error: delPastErr } = await supabase
      .from("matches")
      .delete()
      .eq("is_live", false)
      .lt("start_time", threeHoursAgo)
      .select("id");

    if (delPastErr) {
      console.error("Error deleting past matches:", delPastErr);
    } else if (deletedPast && deletedPast.length > 0) {
      console.log(`Removed ${deletedPast.length} ended (past) matches`);
    }

    // Delete live matches that have exceeded 120 minutes (match ended)
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

    return new Response(JSON.stringify({ matches: allMatches, count: allMatches.length }), {
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
