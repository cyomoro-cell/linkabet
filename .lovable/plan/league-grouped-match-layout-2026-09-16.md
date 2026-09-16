# League-Grouped Match Layout

## What will change
- Model the supplied JSON hierarchy as league sections: `Sctns[]` → `Ts` → `Evs[]`, using `Snm` for the league and `Cnm` for the country.
- Add a reusable league container that renders one compact match row per event, reading home from `T1[0].Nm`, away from `T2[0].Nm`, and status from `Eps`/`Est`.
- Reorganize the home tabs, all-matches page, and live page into clean league groups instead of an unrelated card grid.
- Update mock data to follow the supplied nested JSON layout, then adapt it into the app’s existing match model so live updates, filters, details, odds, and the bet slip continue working.

## Display behavior
- `NS` events show the kickoff time in the viewer’s local timezone and an “Upcoming” label.
- Live events show their live status/minute and current score when available.
- League headers clearly show country, league name, and the number of visible matches.
- Match rows remain selectable for details, while odds controls remain separate clickable actions.

## Technical details
- Introduce typed JSON-layout interfaces and small conversion/grouping utilities rather than changing the backend database format.
- Derive league groups from filtered matches for realtime data, while preserving the exact supplied structure for mock fixtures.
- Keep the existing dark/lime design tokens and responsive sidebars; replace only the match-list presentation.
- Verify desktop and mobile layouts, interactions, and the preview build after implementation.
