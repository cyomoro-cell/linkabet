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

function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// SportMonks API v3 (primary)
// ---------------------------------------------------------------------------
const SM_BASE = "https://api.sportmonks.com/v3/football";

async function smFetch(apiKey: string, path: string): Promise<any[]> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${SM_BASE}${path}${sep}api_token=${apiKey}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`SportMonks ${path}: ${res.status} - ${body.substring(0, 200)}`);
      return [];
    }
    const data = await res.json();
    return data.data || [];
  } catch (e) {
    console.error(`SportMonks ${path} error:`, e);
    return [];
  }
}

function smCurrentScore(fixture: any, side: "home" | "away"): number | undefined {
  const scores = fixture.scores || [];
  for (const s of scores) {
    if (s.description === "CURRENT" && s.score?.participant === side) {
      return s.score?.goals ?? 0;
    }
  }
  return undefined;
}

function smOdds(fixture: any): { home: number; draw: number; away: number } | null {
  const odds = fixture.odds || [];
  // Market id 1 = Fulltime Result (1X2)
  const home = odds.find((o: any) => o.market_id === 1 && o.label === "1")?.value;
  const draw = odds.find((o: any) => o.market_id === 1 && o.label === "X")?.value;
  const away = odds.find((o: any) => o.market_id === 1 && o.label === "2")?.value;
  if (home && away) {
    return { home: parseFloat(home), away: parseFloat(away), ...(draw ? { draw: parseFloat(draw) } : {}) };
  }
  return null;
}

const SM_LIVE_STATES = [2, 3]; // INPLAY_1ST_HALF=2, INPLAY_2ND_HALF=3 ... varies; use name matching below

function parseSmFixture(f: any): Match | null {
  try {
    const participants = f.participants || [];
    const home = participants.find((p: any) => p.meta?.location === "home");
    const away = participants.find((p: any) => p.meta?.location === "away");
    if (!f.id || !home?.name || !away?.name) return null;

    const stateName = (f.state?.name || f.state?.state || "").toUpperCase();
    const finished = ["FT", "AET", "POSTP", "CANCL", "ABANDONED", "AWARDED", "WO", "DELETED", "EXTRA_TIME_BREAK"].some((s) => stateName.includes(s));
    if (finished) return null;

    const isLive = ["LIVE", "HT", "1ST", "2ND", "INPLAY", "ET", "BREAK", "PEN"].some((s) => stateName.includes(s));
    const startingAt = f.starting_at || new Date().toISOString();

    return {
      id: `SM_${f.id}`,
      sport: "football",
      league: f.league?.name || "Unknown League",
      homeTeam: {
        id: `SM_${home.id}`,
        name: home.name,
        score: isLive ? (smCurrentScore(f, "home") ?? 0) : undefined,
      },
      awayTeam: {
        id: `SM_${away.id}`,
        name: away.name,
        score: isLive ? (smCurrentScore(f, "away") ?? 0) : undefined,
      },
      odds: smOdds(f) || generateFallbackOdds(),
      startTime: startingAt.includes("T") ? startingAt : startingAt.replace(" ", "T") + "Z",
      isLive,
      minute: isLive ? undefined : undefined,
    };
  } catch (e) {
    console.error("SportMonks parse error:", e);
    return null;
  }
}

async function fetchSportMonks(apiKey: string): Promise<Match[]> {
  const today = dateStr(0);
  const tomorrow = dateStr(1);

  const [live, todayFix, tomorrowFix] = await Promise.all([
    smFetch(apiKey, "/livescores/inplay?include=participants;league;scores;state"),
    smFetch(apiKey, `/fixtures/date/${today}?include=participants;league;odds;state`),
    smFetch(apiKey, `/fixtures/date/${tomorrow}?include=participants;league;odds;state`),
  ]);

  console.log(`SportMonks live: ${live.length}, today: ${todayFix.length}, tomorrow: ${tomorrowFix.length}`);

  const seen = new Set<string>();
  const out: Match[] = [];
  for (const f of [...live, ...todayFix, ...tomorrowFix]) {
    const m = parseSmFixture(f);
    if (m && !seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
    if (out.length >= 100) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// API-Football (fallback)
// ---------------------------------------------------------------------------
const API_BASE = "https://v3.football.api-sports.io";

async function fetchOddsMap(apiKey: string, date: string): Promise<Map<number, { home: number; draw: number; away: number }>> {
  const map = new Map();
  try {
    const res = await fetch(`${API_BASE}/odds?date=${date}&bookmaker=8`, {
      headers: { "x-apisports-key": apiKey },
    });
    if (!res.ok) {
      console.warn(`odds ${date}: ${res.status}`);
      return map;
    }
    const data = await res.json();
    for (const item of data.response || []) {
      const bet = item.bookmakers?.[0]?.bets?.find((b: any) => b.name === "Match Winner");
      if (!bet) continue;
      const home = bet.values?.find((v: any) => v.value === "Home")?.odd;
      const draw = bet.values?.find((v: any) => v.value === "Draw")?.odd;
      const away = bet.values?.find((v: any) => v.value === "Away")?.odd;
      if (home && away) {
        map.set(item.fixture?.id, {
          home: parseFloat(home),
          away: parseFloat(away),
          ...(draw ? { draw: parseFloat(draw) } : {}),
        });
      }
    }
  } catch (e) {
    console.error("odds fetch error:", e);
  }
  return map;
}

async function fetchFixtures(apiKey: string, query: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/fixtures?${query}`, {
      headers: { "x-apisports-key": apiKey },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`fixtures ${query}: ${res.status} - ${body.substring(0, 150)}`);
      return [];
    }
    const data = await res.json();
    if (data.errors && Object.keys(data.errors).length > 0) {
      console.warn(`fixtures ${query} errors:`, JSON.stringify(data.errors));
    }
    return data.response || [];
  } catch (e) {
    console.error(`fixtures ${query} error:`, e);
    return [];
  }
}

const LIVE_STATUSES = ["1H", "HT", "2H", "ET", "BT", "P", "INT"];
const FINISHED_STATUSES = ["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"];

function parseFixture(f: any, oddsMap: Map<number, { home: number; draw: number; away: number }>): Match | null {
  try {
    const fixture = f.fixture;
    const league = f.league;
    const teams = f.teams;
    if (!fixture?.id || !teams?.home?.name || !teams?.away?.name) return null;

    const status = fixture.status?.short || "NS";
    if (FINISHED_STATUSES.includes(status)) return null;

    const isLive = LIVE_STATUSES.includes(status);
    const realOdds = oddsMap.get(fixture.id);

    return {
      id: `AF_${fixture.id}`,
      sport: "football",
      league: league?.name || "Unknown League",
      homeTeam: {
        id: `AF_${teams.home.id}`,
        name: teams.home.name,
        score: isLive ? (f.goals?.home ?? 0) : undefined,
      },
      awayTeam: {
        id: `AF_${teams.away.id}`,
        name: teams.away.name,
        score: isLive ? (f.goals?.away ?? 0) : undefined,
      },
      odds: realOdds || generateFallbackOdds(),
      startTime: fixture.date || new Date().toISOString(),
      isLive,
      minute: isLive ? (fixture.status?.elapsed ?? undefined) : undefined,
    };
  } catch (e) {
    console.error("parse error:", e);
    return null;
  }
}

async function fetchApiFootball(apiKey: string): Promise<Match[]> {
  const today = dateStr(0);
  const tomorrow = dateStr(1);

  const [live, todayFixtures, tomorrowFixtures, oddsMap] = await Promise.all([
    fetchFixtures(apiKey, "live=all"),
    fetchFixtures(apiKey, `date=${today}`),
    fetchFixtures(apiKey, `date=${tomorrow}`),
    fetchOddsMap(apiKey, today),
  ]);

  console.log(`API-Football live: ${live.length}, today: ${todayFixtures.length}, tomorrow: ${tomorrowFixtures.length}, odds: ${oddsMap.size}`);

  const seen = new Set<string>();
  const out: Match[] = [];
  for (const f of [...live, ...todayFixtures, ...tomorrowFixtures]) {
    const m = parseFixture(f, oddsMap);
    if (m && !seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
    if (out.length >= 100) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mocks & helpers
// ---------------------------------------------------------------------------
function generateFallbackOdds() {
  return {
    home: parseFloat((1.5 + Math.random() * 2).toFixed(2)),
    draw: parseFloat((2.5 + Math.random() * 1.5).toFixed(2)),
    away: parseFloat((1.8 + Math.random() * 2.2).toFixed(2)),
  };
}

function generateMockMatches(count: number): Match[] {
  const leagues = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "Champions League"];
  const teams = ["Manchester City", "Liverpool", "Real Madrid", "Barcelona", "Bayern Munich", "PSG", "Juventus", "AC Milan", "Inter Milan", "Chelsea"];
  const matches: Match[] = [];
  for (let i = 0; i < count; i++) {
    const league = leagues[Math.floor(Math.random() * leagues.length)];
    const hi = Math.floor(Math.random() * teams.length);
    let ai = Math.floor(Math.random() * teams.length);
    while (ai === hi) ai = Math.floor(Math.random() * teams.length);
    matches.push({
      id: `MOCK_${league.replace(/\s/g, "")}_${i}_${Date.now()}`,
      sport: "football",
      league,
      homeTeam: { id: `home_${i}`, name: teams[hi] },
      awayTeam: { id: `away_${i}`, name: teams[ai] },
      odds: generateFallbackOdds(),
      startTime: new Date(Date.now() + (15 + Math.random() * 720) * 60 * 1000).toISOString(),
      isLive: false,
    });
  }
  return matches;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const smKey = Deno.env.get("SPORTMONKS_API_KEY");
    const afKey = Deno.env.get("API_FOOTBALL_KEY");
    let allMatches: Match[] = [];
    let source = "mock-fallback";

    // Primary: SportMonks
    if (smKey) {
      console.log("Fetching from SportMonks...");
      allMatches = await fetchSportMonks(smKey);
      if (allMatches.length > 0) source = "SportMonks";
    } else {
      console.warn("SPORTMONKS_API_KEY not set");
    }

    // Fallback: API-Football
    if (allMatches.length === 0 && afKey) {
      console.log("SportMonks empty, trying API-Football...");
      allMatches = await fetchApiFootball(afKey);
      if (allMatches.length > 0) source = "API-Football";
    }

    // Fill with mocks if real APIs returned little
    if (allMatches.length < 15) {
      const mockCount = 15 - allMatches.length;
      console.log(`Adding ${mockCount} mock matches`);
      allMatches.push(...generateMockMatches(mockCount));
    }

    // Sort: live first, then by start time
    allMatches.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    // Filter ended/stale matches
    const now = Date.now();
    const uniqueMatches = allMatches.filter((m) => {
      if (!m.isLive && new Date(m.startTime).getTime() < now) return false;
      if (m.isLive && m.minute && m.minute > 120) return false;
      return true;
    });

    // Upsert to DB
    const dbRows = uniqueMatches.map((m) => ({
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

    const { error: upsertError } = await supabase.from("matches").upsert(dbRows, { onConflict: "id" });
    if (upsertError) console.error("Upsert error:", upsertError);
    else console.log(`Upserted ${dbRows.length} matches (source: ${source})`);

    // Cleanup: remove stale matches
    await supabase.from("matches").delete().eq("is_live", false).lt("start_time", new Date().toISOString());
    await supabase.from("matches").delete().eq("is_live", true).gt("minute", 120);

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
