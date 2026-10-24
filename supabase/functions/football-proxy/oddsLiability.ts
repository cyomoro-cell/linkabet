export type Outcome = 'home' | 'draw' | 'away';
export type Stakes = Record<Outcome, number>;

const OUTCOMES: Outcome[] = ['home', 'draw', 'away'];

/**
 * Recalculate odds so the house keeps `targetMargin` of total stakes
 * no matter which outcome wins.
 *
 * For each outcome: payout = stake × odds must equal totalStakes × (1 − margin),
 * so odds = totalStakes × (1 − margin) / stake.
 * Outcomes with no stake keep their original odds (no liability on them).
 *
 * @param originalOdds [home, draw, away] base odds
 * @param stakes       money staked per outcome, e.g. { home: 1000, draw: 500, away: 200 }
 * @param targetMargin fraction the house keeps, e.g. 0.05 for 5%
 * @returns new odds as [home, draw, away], rounded to 2 decimals
 */
export function adjustOddsForLiability(originalOdds: number[], stakes: Stakes, targetMargin: number): number[] {
  if (originalOdds.length !== 3) throw new Error('originalOdds must be [home, draw, away]');
  if (!(targetMargin >= 0 && targetMargin < 1)) throw new Error('targetMargin must be between 0 and 1');

  const total = OUTCOMES.reduce((sum, o) => sum + Math.max(0, stakes[o] ?? 0), 0);
  if (total === 0) return [...originalOdds];

  const payoutPool = total * (1 - targetMargin);
  return OUTCOMES.map((o, i) => {
    const stake = Math.max(0, stakes[o] ?? 0);
    if (stake === 0) return originalOdds[i];
    return Math.floor((payoutPool / stake) * 100) / 100; // round down so the house never pays more than planned
  });
}
