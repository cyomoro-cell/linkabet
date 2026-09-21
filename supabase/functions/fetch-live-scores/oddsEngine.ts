/**
 * Live odds engine — mirrors the database `recalculate_odds()` trigger so odds
 * are already populated on every upsert (even before the trigger runs).
 */

export interface LiveOddsInput {
  homeScore?: number | null;
  awayScore?: number | null;
  minute?: number | null;
  status?: string | null;
  redCard?: boolean | null;
}

export interface LiveOddsResult {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  oddsStatus: 'open' | 'suspended';
}

const HOUSE_MARGIN = 1.05; // 5% overround
const HOME_XG_BASELINE = 1.35;
const AWAY_XG_BASELINE = 1.1;
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'CANCELLED', 'POSTPONED'];

export function calculateLiveOdds(input: LiveOddsInput): LiveOddsResult {
  const minute = Math.max(0, input.minute ?? 0);
  const homeScore = input.homeScore ?? 0;
  const awayScore = input.awayScore ?? 0;

  const timeRatio = Math.max(0, (90 - Math.min(minute, 90)) / 90);
  const xgHome = HOME_XG_BASELINE * timeRatio + homeScore;
  const xgAway = AWAY_XG_BASELINE * timeRatio + awayScore;

  const denom = Math.exp(xgHome) + Math.exp(xgAway) + Math.exp((xgHome + xgAway) / 2);
  let pHome = Math.exp(xgHome) / denom;
  let pAway = Math.exp(xgAway) / denom;
  let pDraw = Math.max(1 - pHome - pAway, 0.05);

  const total = pHome + pDraw + pAway;
  pHome /= total;
  pDraw /= total;
  pAway /= total;

  const toOdds = (p: number) => Math.round(Math.max(1.01, 1 / (p * HOUSE_MARGIN)) * 100) / 100;

  const status = (input.status ?? '').toUpperCase();
  const suspended =
    minute > 88 || Boolean(input.redCard) || FINISHED_STATUSES.includes(status);

  return {
    homeOdds: toOdds(pHome),
    drawOdds: toOdds(pDraw),
    awayOdds: toOdds(pAway),
    oddsStatus: suspended ? 'suspended' : 'open',
  };
}
