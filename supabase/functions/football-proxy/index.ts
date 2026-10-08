import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const key = Deno.env.get('FIVE_DOLLAR_FOOTBALL_API_KEY');
  const r = await fetch('https://api.5dollarfootballapi.com/v1/fixtures?include=odds', { headers: { Authorization: `Bearer ${key}` } });
  const t = await r.text();
  return new Response(JSON.stringify({ status: r.status, body: t.slice(0, 4000) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
