# Linkabet sports-data API audit

**Scope:** static repository review of the sports-data integrations on `main`. This is not a live API smoke test: repository access does not prove that deployed Edge Functions, provider credentials, quota, or current responses are working.

## Current integrations found

| Area | Current implementation | Required configuration / caveat |
|---|---|---|
| Football fixtures and scores | `supabase/functions/football-proxy/index.ts` calls `https://api.5dollarfootballapi.com/v1` | Reads `FIVE_DOLLAR_FOOTBALL_API_KEY` from Supabase Edge Function secrets. Uses `sports_cache` in Supabase. |
| Football odds fields | Same `football-proxy` function requests fixture odds and normalizes 1X2 values | Odds are cached separately; only a few stale fixtures are refreshed per invocation. Do not assume every displayed price is current. |
| Football page data | `src/hooks/useFootballMatches.ts` invokes the `football-proxy` Edge Function | React Query refresh interval is 120 seconds; stale time is 60 seconds. |
| Live/match lists | `src/hooks/useRealtimeMatches.ts` reads `matches` in Supabase, subscribes to Postgres Changes, and also calls `useMatches` | Database content can take precedence over API results. The client triggers refresh every 15 seconds, but that does not guarantee a fresh upstream response because upstream caching/rate limits still apply. |
| Scores, standings and news | `supabase/functions/sports-data/index.ts` uses Apify's RAG web browser through the Lovable connector, then the Lovable AI Gateway to extract structured data from BBC Sport and ESPN pages | Requires server-side `LOVABLE_API_KEY` and `APIFY_API_KEY`. It is page extraction, not a structured official sports API; page layout, quotas, extraction quality, and source terms can affect results. Cache TTL is 60 seconds. Configured sources cover football and NBA basketball only. |
| Client-to-backend calls | Frontend invokes Supabase Edge Functions using the Supabase JS client | `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are public-client configuration; privileged provider keys and the Supabase service-role key must remain Edge Function secrets only. |
| Other backend integrations | `supabase/functions/ai-assistant/index.ts` calls the Lovable AI Gateway; `bootstrap-user` uses Supabase Auth and service-role writes | Separate from sports-data. The AI assistant must derive identity from a verified user JWT rather than trust a client-supplied `userId`; review authorization before production use. |

## Findings and gaps

1. **Two sports-data paths exist.** The football fixtures hook uses the 5DollarFootballAPI proxy, while the generic sports-data hook uses web extraction + AI. They have different freshness, error, and attribution behavior.
2. **The roadmap and code are out of sync.** `roadmap.md` says API-Football was the selected source, but the current `football-proxy` source URL is 5DollarFootballAPI. Confirm the intended licensed provider and update documentation accordingly.
3. **Live functionality is not verified from source alone.** A configured secret, active Supabase function deployment, database cache table, valid plan/quota, and successful upstream responses are needed to confirm live data.
4. **Provider coverage is uneven.** The direct fixture proxy is football-only. The generic extraction path covers football and NBA pages, not all sports listed in the UI.
5. **Freshness needs to be visible.** UI should show provider/source, last successful fetch time, stale status, and an explicit unavailable state rather than silently implying scores are live.
6. **Use one typed service boundary.** Route match lists, live lists, match details, and score displays through a shared server-backed sports-data contract; keep provider adapters and secrets server-side.
7. **Secrets hygiene.** Never commit a private provider key, Lovable key, or Supabase service-role key. Keep local `.env` files ignored and configure secrets in the hosting environment. The Supabase publishable/anon key is intended for browser use, but database access must still be protected by correct RLS policies.

## Safe next implementation sequence

- [ ] Confirm which licensed provider should be authoritative for football fixtures, scores, and standings.
- [ ] Verify the existing `football-proxy` function is deployed and `FIVE_DOLLAR_FOOTBALL_API_KEY` is configured in Supabase secrets (do not paste the key into chat or commit it).
- [ ] Run a backend smoke test against the Edge Function and record status, provider, fetched timestamp, cache age, and item count without logging credentials.
- [ ] Standardize the response shape and error/stale metadata across the fixture proxy and generic sports-data function.
- [ ] Update UI loading, retry, last-updated, source-attribution, and unavailable states.
- [ ] Run `npm run lint`, `npm test`, and `npm run build`; report results rather than assuming they pass.

## Betnex note

This audit does not connect to Betnex. Keep Linkabet's sports-data layer independent of gambling/game-launch services. If you choose another sports-data provider, use its documented sports-data endpoints and credentials under its terms, and call it from a server-side adapter. Do not expose provider keys in browser code.
