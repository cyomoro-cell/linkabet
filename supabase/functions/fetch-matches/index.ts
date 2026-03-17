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

// ─── SportMonks API v3 ───
// Docs: https://docs.sportmonks.com/v3
// Auth: ?api_token=YOUR_TOKEN
// Base: https://api.sportmonks.com/v3/football

async function fetchSportMonks(apiKey: string): Promise<Match[]> {
  const matches: Match[] = [];
  const headers = { "Accept": "application/json" };

  // Try football livescores (all - includes 15min before/after)
  await fetchSportMonksEndpoint(
    `https://api.sportmonks.com/v3/football/livescores?api_token=${apiKey}&include=participants;scores;league;state`,
    "football livescores", matches, headers, "football", true
  );

  // Try football fixtures for today and tomorrow
  const today = getTodayDate();
  const tomorrow = getTomorrowDate();
  await fetchSportMonksEndpoint(
    `https://api.sportmonks.com/v3/football/fixtures/date/${today}?api_token=${apiKey}&include=participants;scores;league;state`,
    "football today", matches, headers, "football", false
  );
  await fetchSportMonksEndpoint(
    `https://api.sportmonks.com/v3/football/fixtures/date/${tomorrow}?api_token=${apiKey}&include=participants;scores;league;state`,
    "football tomorrow", matches, headers, "football", false
  );

  // Try cricket (also in free plan)
  await fetchSportMonksEndpoint(
    `https://api.sportmonks.com/v3/cricket/livescores?api_token=${apiKey}&include=participants;scores;league;state`,
    "cricket livescores", matches, headers, "cricket", true
  );
  await fetchSportMonksEndpoint(
    `https://api.sportmonks.com/v3/cricket/fixtures/date/${today}?api_token=${apiKey}&include=participants;scores;league;state`,
    "cricket today", matches, headers, "cricket", false
  );
  await fetchSportMonksEndpoint(
    `https://api.sportmonks.com/v3/cricket/fixtures/date/${tomorrow}?api_token=${apiKey}&include=participants;scores;league;state`,
    "cricket tomorrow", matches, headers, "cricket", false
  );

  // Also try upcoming fixtures (next 7 days) if we still have few matches
  if (matches.length < 10) {
    const weekLater = getDateOffset(7);
    await fetchSportMonksEndpoint(
      `https://api.sportmonks.com/v3/football/fixtures/between/${today}/${weekLater}?api_token=${apiKey}&include=participants;league&per_page=50`,
      "football week", matches, headers, "football", false
    );
  }

  console.log(`SportMonks total: ${matches.length} matches`);
  return matches;
}

async function fetchSportMonksEndpoint(
  url: string, label: string, matches: Match[], headers: Record<string, string>,
  sport: string, isLiveEndpoint: boolean
) {
  try {
    console.log(`SportMonks: fetching ${label}...`);
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      const fixtures = data.data || [];
      console.log(`SportMonks ${label}: ${fixtures.length} results`);
      if (fixtures.length === 0 && data.message) {
        console.log(`SportMonks ${label} message: ${data.message}`);
      }
      const existingIds = new Set(matches.map(m => m.id));
      for (const fixture of fixtures.slice(0, 50)) {
        const parsed = parseSportMonksFixture(fixture, isLiveEndpoint, sport);
        if (parsed && !existingIds.has(parsed.id)) {
          matches.push(parsed);
          existingIds.add(parsed.id);
        }
      }
    } else {
      console.warn(`SportMonks ${label} error: ${res.status}`);
    }
  } catch (e) {
    console.error(`SportMonks ${label} error:`, e);
  }
}
  return matches;
}

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseSportMonksFixture(fixture: any, fromLive: boolean, sport: string = "football"): Match | null {
  try {
    const participants = fixture.participants || [];
    if (participants.length < 2) return null;

    const home = participants.find((p: any) => p.meta?.location === "home") || participants[0];
    const away = participants.find((p: any) => p.meta?.location === "away") || participants[1];

    // Parse scores
    let homeScore: number | undefined;
    let awayScore: number | undefined;
    const scores = fixture.scores || [];
    for (const s of scores) {
      if (s.description === "CURRENT" || s.description === "2ND_HALF" || s.description === "1ST_HALF") {
        if (s.score?.participant === "home") homeScore = s.score.goals;
        if (s.score?.participant === "away") awayScore = s.score.goals;
      }
    }
    // Fallback: check participant meta for score
    if (homeScore === undefined && home.meta?.winner !== undefined) {
      homeScore = home.meta?.score;
    }
    if (awayScore === undefined && away.meta?.winner !== undefined) {
      awayScore = away.meta?.score;
    }

    // Determine live state from state_id or state object
    const stateId = fixture.state_id;
    // SportMonks state IDs: 1=NS, 2=1H, 3=HT, 4=2H, 5=FT, etc.
    const liveStateIds = [2, 3, 4, 6, 7, 22, 23, 24, 25]; // Various in-play states
    const endedStateIds = [5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]; // FT, AET, etc.
    const isLive = fromLive || liveStateIds.includes(stateId);
    const isEnded = endedStateIds.includes(stateId);
    if (isEnded) return null;

    // Parse minute from state
    let minute: number | undefined;
    if (isLive && fixture.state?.clock) {
      minute = fixture.state.clock;
    } else if (isLive) {
      // Estimate based on state
      if (stateId === 2) minute = Math.floor(Math.random() * 45) + 1;
      else if (stateId === 3) minute = 45;
      else if (stateId === 4) minute = Math.floor(Math.random() * 45) + 46;
    }

    // League name
    const league = fixture.league?.name || "Unknown League";

    // Parse odds
    const odds = parseSportMonksOdds(fixture);

    return {
      id: `SM_${fixture.id}`,
      sport,
      league,
      homeTeam: {
        id: `SM_${home.id}`,
        name: home.name || home.common_name || "Home",
        score: isLive ? (homeScore ?? 0) : undefined,
      },
      awayTeam: {
        id: `SM_${away.id}`,
        name: away.name || away.common_name || "Away",
        score: isLive ? (awayScore ?? 0) : undefined,
      },
      odds,
      startTime: fixture.starting_at || new Date().toISOString(),
      isLive,
      minute,
    };
  } catch (e) {
    console.error("Error parsing SportMonks fixture:", e);
    return null;
  }
}

function parseSportMonksOdds(fixture: any): { home: number; draw?: number; away: number } {
  try {
    const oddsData = fixture.odds;
    if (oddsData && Array.isArray(oddsData) && oddsData.length > 0) {
      // Find 1X2 / Match Winner market
      const matchWinner = oddsData.find((o: any) =>
        o.market_id === 1 || o.name === "Match Winner" || o.name === "1X2"
      );
      if (matchWinner && matchWinner.bookmaker && Array.isArray(matchWinner.bookmaker)) {
        const bm = matchWinner.bookmaker[0]; // First bookmaker
        if (bm && bm.odds && Array.isArray(bm.odds)) {
          const h = bm.odds.find((o: any) => o.label === "1" || o.label === "Home");
          const d = bm.odds.find((o: any) => o.label === "X" || o.label === "Draw");
          const a = bm.odds.find((o: any) => o.label === "2" || o.label === "Away");
          if (h && a) {
            return {
              home: parseFloat(h.value) || 2.0,
              draw: d ? parseFloat(d.value) : undefined,
              away: parseFloat(a.value) || 2.0,
            };
          }
        }
      }
    }
  } catch {}
  return generateFallbackOdds("football");
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

    const isLive = Math.random() > 0.6;
    const startOffset = isLive ? 0 : (15 + Math.random() * 7 * 24) * 60 * 1000;

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

    let allMatches: Match[] = [];
    let source = "mock-fallback";

    // Primary: SportMonks API
    const sportMonksKey = Deno.env.get("SPORTMONKS_API_KEY");
    if (sportMonksKey) {
      console.log("Using SportMonks API as primary source...");
      allMatches = await fetchSportMonks(sportMonksKey);
      if (allMatches.length > 0) source = "SportMonks";
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
