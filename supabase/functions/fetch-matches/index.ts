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

// ─── SportMonks API v3 (Primary) ───
async function fetchSportMonks(apiKey: string): Promise<Match[]> {
  const matches: Match[] = [];
  const headers = { "Accept": "application/json" };
  const today = getTodayDate();
  const tomorrow = getTomorrowDate();
  const weekLater = getDateOffset(7);

  // Fetch football endpoints in parallel
  const endpoints = [
    { url: `https://api.sportmonks.com/v3/football/livescores?api_token=${apiKey}&include=participants;scores;league;state`, label: "livescores", live: true },
    { url: `https://api.sportmonks.com/v3/football/fixtures/date/${today}?api_token=${apiKey}&include=participants;scores;league;state`, label: "today", live: false },
    { url: `https://api.sportmonks.com/v3/football/fixtures/date/${tomorrow}?api_token=${apiKey}&include=participants;scores;league;state`, label: "tomorrow", live: false },
    { url: `https://api.sportmonks.com/v3/football/fixtures/between/${today}/${weekLater}?api_token=${apiKey}&include=participants;league&per_page=50`, label: "week", live: false },
  ];

  const results = await Promise.allSettled(
    endpoints.map(ep => fetchSMEndpoint(ep.url, ep.label, headers, "football", ep.live))
  );

  const existingIds = new Set<string>();
  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const m of result.value) {
        if (!existingIds.has(m.id)) {
          matches.push(m);
          existingIds.add(m.id);
        }
      }
    }
  }

  console.log(`SportMonks total: ${matches.length} matches`);
  return matches;
}

async function fetchSMEndpoint(
  url: string, label: string, headers: Record<string, string>,
  sport: string, isLiveEndpoint: boolean
): Promise<Match[]> {
  const matches: Match[] = [];
  try {
    console.log(`SportMonks: fetching ${label}...`);
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      const fixtures = data.data || [];
      console.log(`SportMonks ${label}: ${fixtures.length} results`);
      for (const fixture of fixtures.slice(0, 50)) {
        const parsed = parseSMFixture(fixture, isLiveEndpoint, sport);
        if (parsed) matches.push(parsed);
      }
    } else {
      console.warn(`SportMonks ${label} error: ${res.status}`);
    }
  } catch (e) {
    console.error(`SportMonks ${label} error:`, e);
  }
  return matches;
}

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getTomorrowDate(): string {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getDateOffset(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseSMFixture(fixture: any, fromLive: boolean, sport: string): Match | null {
  try {
    const participants = fixture.participants || [];
    if (participants.length < 2) return null;
    const home = participants.find((p: any) => p.meta?.location === "home") || participants[0];
    const away = participants.find((p: any) => p.meta?.location === "away") || participants[1];

    let homeScore: number | undefined, awayScore: number | undefined;
    for (const s of (fixture.scores || [])) {
      if (["CURRENT", "2ND_HALF", "1ST_HALF"].includes(s.description)) {
        if (s.score?.participant === "home") homeScore = s.score.goals;
        if (s.score?.participant === "away") awayScore = s.score.goals;
      }
    }

    const stateId = fixture.state_id;
    const liveStateIds = [2, 3, 4, 6, 7, 22, 23, 24, 25];
    const endedStateIds = [5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    const isLive = fromLive || liveStateIds.includes(stateId);
    if (endedStateIds.includes(stateId)) return null;

    let minute: number | undefined;
    if (isLive && fixture.state?.clock) minute = fixture.state.clock;
    else if (isLive) {
      if (stateId === 2) minute = Math.floor(Math.random() * 45) + 1;
      else if (stateId === 3) minute = 45;
      else if (stateId === 4) minute = Math.floor(Math.random() * 45) + 46;
    }

    return {
      id: `SM_${fixture.id}`,
      sport,
      league: fixture.league?.name || "Unknown League",
      homeTeam: { id: `SM_${home.id}`, name: home.name || "Home", score: isLive ? (homeScore ?? 0) : undefined },
      awayTeam: { id: `SM_${away.id}`, name: away.name || "Away", score: isLive ? (awayScore ?? 0) : undefined },
      odds: parseSMOdds(fixture, sport),
      startTime: fixture.starting_at || new Date().toISOString(),
      isLive,
      minute,
    };
  } catch (e) {
    console.error("Error parsing fixture:", e);
    return null;
  }
}

function parseSMOdds(fixture: any, sport: string): { home: number; draw?: number; away: number } {
  try {
    const oddsData = fixture.odds;
    if (oddsData && Array.isArray(oddsData) && oddsData.length > 0) {
      const mw = oddsData.find((o: any) => o.market_id === 1 || o.name === "Match Winner" || o.name === "1X2");
      if (mw?.bookmaker?.[0]?.odds) {
        const bm = mw.bookmaker[0].odds;
        const h = bm.find((o: any) => o.label === "1" || o.label === "Home");
        const d = bm.find((o: any) => o.label === "X" || o.label === "Draw");
        const a = bm.find((o: any) => o.label === "2" || o.label === "Away");
        if (h && a) return { home: parseFloat(h.value) || 2.0, draw: d ? parseFloat(d.value) : undefined, away: parseFloat(a.value) || 2.0 };
      }
    }
  } catch {}
  return generateFallbackOdds(sport);
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

    // Primary: SportMonks API
    const smKey = Deno.env.get("SPORTMONKS_API_KEY");
    if (smKey) {
      console.log("Using SportMonks API...");
      allMatches = await fetchSportMonks(smKey);
      if (allMatches.length > 0) source = "SportMonks";
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
