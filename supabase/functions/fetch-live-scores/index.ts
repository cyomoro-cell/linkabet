import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://connector-gateway.lovable.dev/apify';
const ACTOR_ID = 'reminiscent_folder~live-scores-api';

interface ScrapedMatch {
  league?: string;
  country?: string;
  home_team: string;
  away_team: string;
  home_score?: number | null;
  away_score?: number | null;
  status?: string | null;
  match_minute?: number | null;
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function normalizeStatus(raw?: string | null, minute?: number | null): string {
  const s = (raw || '').trim().toUpperCase();
  if (!s) return minute ? '1st Half' : 'NS';
  if (s.includes('FT') || s.includes('FULL')) return 'FT';
  if (s.includes('HT') || s.includes('HALF TIME')) return 'HT';
  if (s === 'NS' || s.includes('UPCOMING') || /^\d{1,2}:\d{2}$/.test(s)) return 'NS';
  if (minute && minute > 45) return '2nd Half';
  if (minute) return '1st Half';
  return raw as string;
}

function parseNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseMinute(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string') {
    const m = v.match(/(\d+)/);
    return m ? Number(m[1]) : null;
  }
  return null;
}

/** Map a raw Apify dataset item (unknown actor output shape) to ScrapedMatch. */
function normalizeItem(raw: Record<string, unknown>): ScrapedMatch | null {
  const home = (raw.home_team ?? raw.homeTeam ?? raw.home ?? raw.home_team_name) as
    | string
    | { name?: string }
    | undefined;
  const away = (raw.away_team ?? raw.awayTeam ?? raw.away ?? raw.away_team_name) as
    | string
    | { name?: string }
    | undefined;
  const homeName = typeof home === 'string' ? home : home?.name;
  const awayName = typeof away === 'string' ? away : away?.name;
  if (!homeName || !awayName) return null;

  return {
    league: (raw.league ?? raw.league_name ?? raw.tournament) as string | undefined,
    country: raw.country as string | undefined,
    home_team: homeName,
    away_team: awayName,
    home_score: parseNum(raw.home_score ?? raw.homeScore ?? raw.home_score_current),
    away_score: parseNum(raw.away_score ?? raw.awayScore ?? raw.away_score_current),
    status: (raw.status ?? raw.match_status ?? raw.state) as string | null,
    match_minute: parseMinute(raw.match_minute ?? raw.minute ?? raw.time),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const apifyKey = Deno.env.get('APIFY_API_KEY');
    if (!lovableKey || !apifyKey) {
      throw new Error('Apify connection is not configured');
    }

    // Run the actor synchronously and get its dataset items directly.
    const res = await fetch(
      `${GATEWAY}/acts/${ACTOR_ID}/run-sync-get-dataset-items?limit=200`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${lovableKey}`,
          'X-Connection-Api-Key': apifyKey,
        },
        body: JSON.stringify({}),
      },
    );

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`Apify request failed [${res.status}]: ${errorBody}`);
      return new Response(
        JSON.stringify({ error: 'Live score provider failed', status: res.status, details: errorBody }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const payload = await res.json();
    const items: Record<string, unknown>[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

    // The actor may return matches flat or nested under a matches/results key.
    const flatItems: Record<string, unknown>[] = [];
    for (const item of items) {
      const nested = (item.matches ?? item.results ?? item.events) as
        | Record<string, unknown>[]
        | undefined;
      if (Array.isArray(nested)) flatItems.push(...nested);
      else flatItems.push(item);
    }

    const scraped = flatItems
      .map(normalizeItem)
      .filter((m): m is ScrapedMatch => m !== null);
    console.log(`Apify returned ${items.length} items, normalized ${scraped.length} matches`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = new Date().toISOString();
    const rows = scraped.map((m) => {
      const externalId = `LS_${slug(m.home_team)}_vs_${slug(m.away_team)}`;
      const minute = m.match_minute;
      const status = normalizeStatus(m.status, minute);
      const live = status !== 'NS' && status !== 'FT';
      return {
        id: externalId,
        external_id: externalId,
        sport: 'football',
        league: m.league || 'Football',
        home_team: { id: slug(m.home_team), name: m.home_team, score: m.home_score ?? 0 },
        away_team: { id: slug(m.away_team), name: m.away_team, score: m.away_score ?? 0 },
        odds: {},
        home_score: m.home_score ?? 0,
        away_score: m.away_score ?? 0,
        status,
        match_time: minute ? `${minute}'` : status,
        minute,
        is_live: live,
        start_time: now,
        updated_at: now,
      };
    });

    if (rows.length > 0) {
      const { error } = await supabase.from('matches').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true, count: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('fetch-live-scores error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
