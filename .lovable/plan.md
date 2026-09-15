# SportMonks Live Odds and Inline Betting

## What will change
- Request SportMonks odds with both live and scheduled fixtures, and mark whether displayed prices are real SportMonks odds or fallbacks.
- Keep real odds synchronized through the existing match refresh and live database updates.
- Upgrade each match card with a clear odds status, selectable 1/X/2 prices, and an inline stake/possible-return panel tied to the existing bet slip.
- Preserve the match-detail link without allowing it to intercept betting controls.

## Technical details
- Extend the match odds model with optional source and live-price metadata stored inside the existing JSON odds field.
- Parse valid SportMonks full-time-result prices robustly, preferring the latest usable bookmaker entries.
- Reuse the Zustand bet-slip stake and selection actions so inline controls and the main bet slip stay synchronized.
- Deploy the updated match function, refresh its data, then verify the preview on desktop and mobile with a clean build.
