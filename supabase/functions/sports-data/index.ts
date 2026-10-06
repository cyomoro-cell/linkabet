import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const GATEWAY = 'https://connector-gateway.lovable.dev/firecrawl/v2';
const CACHE_SECONDS = 60;

// Add or remove sources here — no other code changes needed.
const SOURCES: { sport: string; type: 'scores' | 'standings' | 'news'; name: string; url: string }[] = [
  { sport: 'football', type: 'scores', name: 'BBC Sport', url: 'https://www.bbc.com/sport/football/scores-fixtures' },
  { sport: 'football', type: 'standings', name: 'BBC Sport', url: 'https://www.bbc.com/sport/football/premier-league/table' },
  { sport: 'football', type: 'news', name: 'BBC Sport', url: 'https://www.bbc.com/sport/football' },
  { sport: 'basketball', type: 'scores', name: 'ESPN', url: 'https://www.espn.com/nba/scoreboard' },
  { sport: 'basketball', type: 'standings', name: 'ESPN', url: 'https://www.espn.com/nba/standings' },
  { sport: 'basketball', type: 'news', name: 'ESPN', url: 'https://www.espn.com/nba/' },
];

const SCHEMAS = {
  scores: {
    prompt: 'Extract every game on the page: home team, away team, home score, away score, league, game date, and status (live, final or scheduled). Include minute/clock if live.',
    schema: { type: 'object', properties: { games: { type: 'array', items: { type: 'object', properties: {
      home_team: { type: 'string' }, away_team: { type: 'string' }, home_score: { type: ['number', 'null'] },
      away_score: { type: ['number', 'null'] }, league: { type: 'string' }, game_date: { type: 'string' },
      status: { type: 'string' }, clock: { type: 'string' } }, required: ['home_team', 'away_team'] } } } },
  },
  standings: {
    prompt: 'Extract the league standings table: position, team, played, won, drawn, lost, points.',
    schema: { type: 'object', properties: { league: { type: 'string' }, rows: { type: 'array', items: { type: 'object', properties: {
      position: { type: 'number' }, team: { type: 'string' }, played: { type: 'number' }, won: { type: 'number' },
      drawn: { type: 'number' }, lost: { type: 'number' }, points: { type: 'number' } }, required: ['team'] } } } },
  },
  news: {
    prompt: 'Extract the top news headlines: title, short summary, and link URL.',
    schema: { type: 'object', properties: { articles: { type: 'array', items: { type: 'object', properties: {
      title: { type: 'string' }, summary: { type: 'string' }, url: { type: 'string' } }, required: ['title'] } } } },
  },
};

const Body = z.object({
  sport: z.string().min(1).max(40),
  type: z.enum(['scores', 'standings', 'news']),
  refresh: z.boolean().optional(),
});

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function normStatus(s: string): 'live' | 'final' | 'scheduled' {
  const x = s.toLowerCase();
  if (/(ft|final|full|ended|finished)/.test(x)) return 'final';
  if (/(live|half|ht|'|q\d|\d+:\d+ (1st|2nd|3rd|4th)|in progress)/.test(x)) return 'live';
  return 'scheduled';
}

function normalize(type: string, json: any, sourceName: string) {
  if (type === 'scores') {
    return (Array.isArray(json?.games) ? json.games : [])
      .filter((g: any) => str(g?.home_team) && str(g?.away_team))
      .slice(0, 60)
      .map((g: any, i: number) => {
        const status = normStatus(`${str(g.status)} ${str(g.clock)}`);
        return {
          id: `${i}-${str(g.home_team)}-${str(g.away_team)}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          home_team: str(g.home_team), away_team: str(g.away_team),
          home_score: status === 'scheduled' ? null : num(g.home_score),
          away_score: status === 'scheduled' ? null : num(g.away_score),
          league: str(g.league) || sourceName, game_date: str(g.game_date), status, clock: str(g.clock),
        };
      });
  }
  if (type === 'standings') {
    return (Array.isArray(json?.rows) ? json.rows : []).filter((r: any) => str(r?.team)).slice(0, 40).map((r: any, i: number) => ({
      position: num(r.position) ?? i + 1, team: str(r.team), played: num(r.played), won: num(r.won),
      drawn: num(r.drawn), lost: num(r.lost), points: num(r.points), league: str(json?.league),
    }));
  }
  return (Array.isArray(json?.articles) ? json.articles : []).filter((a: any) => str(a?.title)).slice(0, 30).map((a: any) => ({
    title: str(a.title), summary: str(a.summary), url: str(a.url),
  }));
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return reply({ ok: false, error: 'Invalid request', details: parsed.error.flatten().fieldErrors }, 400);
    const { sport, type, refresh } = parsed.data;

    const source = SOURCES.find((s) => s.sport === sport && s.type === type);
    if (!source) return reply({ ok: false, error: `No source configured for ${sport} ${type}` }, 404);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const key = `${sport}:${type}`;

    const { data: cached } = await db.from('sports_cache').select('payload, fetched_at').eq('cache_key', key).maybeSingle();
    const age = cached ? (Date.now() - new Date(cached.fetched_at).getTime()) / 1000 : Infinity;
    if (!refresh && cached && age < CACHE_SECONDS) {
      return reply({ ok: true, cached: true, source: source.name, fetched_at: cached.fetched_at, items: cached.payload });
    }

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const apifyKey = Deno.env.get('APIFY_API_KEY');
    if (!lovableKey || !apifyKey) return reply({ ok: false, error: 'Sports data source is not configured' }, 500);

    const cfg = SCHEMAS[type];
    // 1) Apify fetches the page as clean markdown.
    const res = await fetch(`${APIFY}/acts/apify~rag-web-browser/run-sync-get-dataset-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lovableKey}`, 'X-Connection-Api-Key': apifyKey },
      body: JSON.stringify({ query: source.url, maxResults: 1, outputFormats: ['markdown'] }),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error(`Apify failed [${res.status}] for ${source.url}: ${details}`);
      if (cached) return reply({ ok: true, cached: true, stale: true, source: source.name, fetched_at: cached.fetched_at, items: cached.payload });
      const limit = /limit|credit|usage/i.test(details);
      return reply({ ok: false, error: limit ? 'The Apify account has reached its monthly usage limit.' : 'Could not load data from the source right now.', status: res.status }, 200);
    }

    const pages = await res.json();
    const markdown = String(pages?.[0]?.markdown ?? '').slice(0, 60000);

    // 2) AI turns the markdown into structured JSON (streamed).
    const ai = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': lovableKey, 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({
        model: 'openai/gpt-6-astra',
        stream: true,
        store: false,
        reasoning: { effort: 'low' },
        instructions: 'You extract structured sports data from web page text. Only use facts present in the text. Reply with JSON only.',
        input: `${cfg.prompt}\n\nPAGE:\n${markdown}`,
        text: { format: { type: 'json_schema', name: 'extract', schema: cfg.schema, strict: false } },
      }),
    });
    if (!ai.ok || !ai.body) {
      console.error(`AI extraction failed [${ai.status}]: ${await ai.text()}`);
      if (cached) return reply({ ok: true, cached: true, stale: true, source: source.name, fetched_at: cached.fetched_at, items: cached.payload });
      return reply({ ok: false, error: 'Could not read the data from the source right now.' }, 200);
    }
    let text = '';
    const reader = ai.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        try {
          const ev = JSON.parse(line.slice(5).trim());
          if (ev.type === 'response.output_text.delta') text += ev.delta ?? '';
        } catch { /* ignore keepalives */ }
      }
    }
    let json: any = {};
    try { json = JSON.parse(text || '{}'); } catch { json = {}; }
    const items = normalize(type, json, source.name);
    const fetched_at = new Date().toISOString();
    await db.from('sports_cache').upsert({ cache_key: key, payload: items, fetched_at });

    return reply({ ok: true, cached: false, source: source.name, fetched_at, items });
  } catch (e) {
    console.error('sports-data error:', e);
    return reply({ ok: false, error: 'Something went wrong loading sports data.' }, 200);
  }
});
