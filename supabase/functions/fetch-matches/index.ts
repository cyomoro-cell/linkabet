import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

// Generate realistic odds
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

// Fetch from TheSportsDB - FREE unlimited API
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
      console.error(`Error fetching ${sport}:`, error);
    }
  }

  return matches;
}

// Fetch from NBA API - FREE unlimited
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
      homeTeam: {
        id: game.homeTeam.teamId.toString(),
        name: game.homeTeam.teamName,
        score: game.homeTeam.score,
      },
      awayTeam: {
        id: game.awayTeam.teamId.toString(),
        name: game.awayTeam.teamName,
        score: game.awayTeam.score,
      },
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

// Generate mock matches for variety
function generateMockMatches(count: number): Match[] {
  const sports = [
    { name: "football", leagues: ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "Champions League"] },
    { name: "basketball", leagues: ["NBA", "EuroLeague", "CBA"] },
    { name: "tennis", leagues: ["ATP Tour", "WTA Tour", "Grand Slam"] },
    { name: "cricket", leagues: ["IPL", "Big Bash", "International"] },
    { name: "esports", leagues: ["LoL Worlds", "Dota 2 TI", "CS:GO Major"] },
    { name: "mma", leagues: ["UFC", "Bellator", "ONE Championship"] },
  ];

  const teams: Record<string, string[]> = {
    football: ["Manchester City", "Liverpool", "Real Madrid", "Barcelona", "Bayern Munich", "PSG", "Juventus", "AC Milan"],
    basketball: ["Lakers", "Warriors", "Celtics", "Bucks", "Heat", "Suns", "Nuggets", "76ers"],
    tennis: ["Djokovic", "Alcaraz", "Sinner", "Medvedev", "Rune", "Zverev"],
    cricket: ["India", "Australia", "England", "New Zealand", "Pakistan", "South Africa"],
    esports: ["T1", "Gen.G", "JDG", "BLG", "Fnatic", "G2", "Cloud9", "Team Liquid"],
    mma: ["Fighter A", "Fighter B", "Champion", "Contender"],
  };

  const matches: Match[] = [];

  for (let i = 0; i < count; i++) {
    const sport = sports[Math.floor(Math.random() * sports.length)];
    const league = sport.leagues[Math.floor(Math.random() * sport.leagues.length)];
    const sportTeams = teams[sport.name] || ["Team A", "Team B"];
    
    const homeIdx = Math.floor(Math.random() * sportTeams.length);
    let awayIdx = Math.floor(Math.random() * sportTeams.length);
    while (awayIdx === homeIdx && sportTeams.length > 1) {
      awayIdx = Math.floor(Math.random() * sportTeams.length);
    }

    const isLive = Math.random() > 0.7;
    const startOffset = isLive ? 0 : Math.random() * 7 * 24 * 60 * 60 * 1000;

    matches.push({
      id: `MOCK_${Date.now()}_${i}`,
      sport: sport.name,
      league,
      homeTeam: {
        id: `home_${i}`,
        name: sportTeams[homeIdx],
        score: isLive ? Math.floor(Math.random() * 5) : undefined,
      },
      awayTeam: {
        id: `away_${i}`,
        name: sportTeams[awayIdx],
        score: isLive ? Math.floor(Math.random() * 5) : undefined,
      },
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
    const allMatches: Match[] = [];

    // Tier 1: Fetch from unlimited free APIs
    const [sportsDbMatches, nbaMatches] = await Promise.all([
      fetchTheSportsDB(),
      fetchNBA(),
    ]);

    allMatches.push(...sportsDbMatches, ...nbaMatches);
    console.log(`Fetched ${allMatches.length} matches from APIs`);

    // Fill with mock data if needed
    if (allMatches.length < 20) {
      const mockMatches = generateMockMatches(20 - allMatches.length);
      allMatches.push(...mockMatches);
      console.log(`Added ${mockMatches.length} mock matches`);
    }

    // Sort by live first, then by start time
    allMatches.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    return new Response(JSON.stringify({ matches: allMatches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    
    // Return mock data on error
    const mockMatches = generateMockMatches(20);
    return new Response(JSON.stringify({ matches: mockMatches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
