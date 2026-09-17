import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://connector-gateway.lovable.dev/firecrawl/v2';

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

const extractionSchema = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          league: { type: 'string' },
          country: { type: 'string' },
          home_team: { type: 'string' },
          away_team: { type: 'string' },
          home_score: { type: 'number' },
          away_score: { type: 'number' },
          status: { type: 'string' },
          match_minute: { type: 'number' },
        },
        required: ['home_team', 'away_team'],
      },
    },
  },
  required: ['matches'],
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!lovableKey || !firecrawlKey) {
      throw new Error('Firecrawl connection is not configured');
    }

    const res = await fetch(`${GATEWAY}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': firecrawlKey,
      },
      body: JSON.stringify({
        url: 'https://www.livescore.com/en/',
        onlyMainContent: true,
        waitFor: 3000,
        formats: [
          {
            type: 'json',
            schema: extractionSchema,
            prompt:
              'Extract every football match listed. For each: league name, country, home team, away team, home score, away score, current status (e.g. "1st Half", "HT", "2nd Half", "FT", "NS" for not started) and the match minute as a number when in play.',
          },
        ],
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`Firecrawl request failed [${res.status}]: ${errorBody}`);
      return new Response(
        JSON.stringify({ error: 'Live score provider failed', status: res.status, details: errorBody }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const payload = await res.json();
    const json = payload.json ?? payload.data?.json ?? {};
    const scraped: ScrapedMatch[] = Array.isArray(json.matches) ? json.matches : [];
    console.log(`Scraped ${scraped.length} matches from livescore.com`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = new Date().toISOString();
    const rows = scraped
      .filter((m) => m.home_team && m.away_team)
      .map((m) => {
        const externalId = `LS_${slug(m.home_team)}_vs_${slug(m.away_team)}`;
        const minute = typeof m.match_minute === 'number' ? m.match_minute : null;
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
