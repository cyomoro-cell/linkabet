# Roadmap

- [x] Replace all sports APIs with API-Football (v3.football.api-sports.io)
- [x] Remove unused old API keys
- [x] Verify typecheck build errors are resolved
- [x] Reorganize match lists into country and league containers
- [x] Live scores via Firecrawl (fetch-live-scores) + 2-minute schedule
- [x] Automatic live odds recalculation with 5% margin and suspension rules
- [x] Live score dashboard page at /live-scores with realtime updates
- [x] Odds engine utility, odds saved on every live-scores refresh
- [ ] Live scores table grouped by league, last-updated time, postponed handling (source URL for Firecrawl pending from user)
- [ ] MTN MoMo deposits/withdrawals (waiting on credentials from user)

## Redesign (Oct 6)
- [x] Hero: animated mesh/particles, gradient "Win Bigger", bet slip mockup, trust badges, glass Watch Live
- [x] Promotions: hover lift/glow, gradient overlay, big icons, pulsing badges, countdown, arrow links
- [x] Footer: newsletter, payment logos, language switcher, rating widget, glowing socials, gradient top border
- [x] Homepage: live ticker, mobile wallet bar, live chat button, big wins carousel
- [x] /sports 3-column page (sidebar, league match rows, bet slip with Singles/Accumulator/System)
- [x] OddsButton (flash + trend arrow) and MatchRow (pre-match/live, simulated odds, favorite star)
- [x] Add 5dollarfootballapi as real sports data source

- [x] Match list with league, teams, time, 1/X/2 odds (sample fallback)
- [x] Floating bet slip panel: selections, stake, payout, Place Bet, empty message

## Improvement pass (requested Oct 28) — virtual points only, no real money
- [ ] SECURITY: server-side place_bet / cashout / admin settle RPCs (auth.uid, row lock, idempotency, server odds); drop "Users can update own wallet", self-insert on transactions and bets; fix ai-assistant trusting body userId (see .lovable/plan.md)
- [ ] Remove real-money flows: deposits, withdrawals, payment copy, cash-style cashout; relabel as virtual points with no cash value
- [ ] Central typed sports-data service via football-proxy for home, live, matches, match detail, standings, news; explicit "not configured"/unavailable states
- [ ] Remove mockData.ts and all hardcoded teams/scores/odds/wins/ratings from runtime views
- [ ] Fix double signUp call in AuthPage
- [ ] UI: skeletons, retry, filters (live/upcoming/finished), last-updated + source attribution
- [ ] Run type/build checks; report verified vs unverified
