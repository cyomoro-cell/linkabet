import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const API = 'https://api.5dollarfootballapi.com/v1';
const FIXTURE_TTL = 600; // seconds — free plan allows 60 requests/hour
const ODDS_TTL = 1800;
const ODDS_PER_RUN = 4;

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function api(path: string, key: string) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${key}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${j?.error?.code ?? ''} ${j?.error?.message ?? ''}`);
  return j;
}

function pick1x2(o: any) {
  const m = o?.['1x2'] ?? o?.data?.['1x2'] ?? o;
  const v = m?.inplay ?? m?.closing ?? m?.opening;
  const ok = (n: unknown) => typeof n === 'number' && n > 1;
  return v && ok(v.home) && ok(v.away) ? { home: v.home, draw: ok(v.draw) ? v.draw : undefined, away: v.away } : null;
}

function norm(f: any, odds: any) {
  const live = f.status === 'live';
  return {
    id: `FD_${f.id}`,
    fixtureId: f.id,
    league: f.league?.name ?? 'Football',
    home: f.teams?.home?.name ?? 'Home',
    away: f.teams?.away?.name ?? 'Away',
    startTime: f.kickoff_utc,
    live,
    minute: typeof f.minute === 'number' ? f.minute : typeof f.elapsed === 'number' ? f.elapsed : undefined,
    homeScore: f.goals?.home ?? undefined,
    awayScore: f.goals?.away ?? undefined,
    odds: odds ?? pick1x2(f.odds),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const key = Deno.env.get('FIVE_DOLLAR_FOOTBALL_API_KEY');
    if (!key) return reply({ ok: false, error: 'Football data is not configured' });
    const body = await req.json().catch(() => ({}));
    if (typeof body?.debug === 'string' && body.debug.startsWith('/')) { try { return reply(await api(body.debug, key)); } catch (e) { return reply({ err: String(e) }); } }
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: cached } = await db.from('sports_cache').select('payload, fetched_at').eq('cache_key', 'fd:matches').maybeSingle();
    const age = cached ? (Date.now() - new Date(cached.fetched_at).getTime()) / 1000 : Infinity;
    if (cached && age < FIXTURE_TTL) return reply({ ok: true, cached: true, fetched_at: cached.fetched_at, matches: cached.payload });

    let fixtures: any[] = [];
    try {
      const now = Math.floor(Date.now() / 1000);
      const live = await api('/fixtures?status=live&per_page=500', key);
      const all: any[] = [...(live.data ?? [])];
      for (let d = 0; d < 3 && all.length < 25; d++) {
        const s = now + d * 86400;
        const up = await api(`/fixtures?status=scheduled&start_time=${s}&end_time=${s + 86400}&per_page=100`, key);
        all.push(...(up.data ?? []));
      }
      const seen = new Set<number>();
      for (const f of all) {
        if (seen.has(f.id) || f.status === 'finished') continue;
        seen.add(f.id);
        fixtures.push(f);
      }
    } catch (e) {
      console.error('fixtures failed', e);
      if (cached) return reply({ ok: true, cached: true, stale: true, fetched_at: cached.fetched_at, matches: cached.payload });
      return reply({ ok: false, error: 'Could not load matches right now.' });
    }

    // Odds cache (per fixture, refreshed a few at a time to respect the hourly limit)
    const { data: oc } = await db.from('sports_cache').select('payload').eq('cache_key', 'fd:odds').maybeSingle();
    const oddsMap: Record<string, { o: any; t: number }> = (oc?.payload as any) ?? {};
    const stale = fixtures
      .filter((f) => !oddsMap[f.id] || Date.now() - oddsMap[f.id].t > ODDS_TTL * 1000)
      .sort((a, b) => (b.status === 'live' ? 1 : 0) - (a.status === 'live' ? 1 : 0))
      .slice(0, ODDS_PER_RUN);
    await Promise.all(stale.map(async (f) => {
      try { oddsMap[f.id] = { o: pick1x2((await api(`/fixtures/${f.id}/odds`, key)).data), t: Date.now() }; }
      catch (e) { console.error('odds failed', f.id, String(e)); }
    }));
    const ids = new Set(fixtures.map((f) => String(f.id)));
    for (const k of Object.keys(oddsMap)) if (!ids.has(k)) delete oddsMap[k];

    const matches = fixtures.map((f) => norm(f, oddsMap[f.id]?.o)).slice(0, 150);
    const fetched_at = new Date().toISOString();
    await db.from('sports_cache').upsert([
      { cache_key: 'fd:matches', payload: matches, fetched_at },
      { cache_key: 'fd:odds', payload: oddsMap, fetched_at },
    ]);
    return reply({ ok: true, cached: false, fetched_at, matches });
  } catch (e) {
    console.error('football-proxy error', e);
    return reply({ ok: false, error: 'Something went wrong loading matches.' });
  }
});
