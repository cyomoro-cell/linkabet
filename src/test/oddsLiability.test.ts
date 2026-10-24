import { describe, it, expect } from 'vitest';
import { adjustOddsForLiability } from '@/utils/oddsLiability';

describe('adjustOddsForLiability', () => {
  const stakes = { home: 1000, draw: 500, away: 200 };

  it('gives odds 1.61 / 3.23 / 8.07 for the example stakes at 5% margin', () => {
    expect(adjustOddsForLiability([2, 3.4, 3.6], stakes, 0.05)).toEqual([1.61, 3.23, 8.07]);
  });

  it('house keeps at least the target margin whichever outcome wins', () => {
    const odds = adjustOddsForLiability([2, 3.4, 3.6], stakes, 0.05);
    const total = 1700;
    [stakes.home * odds[0], stakes.draw * odds[1], stakes.away * odds[2]].forEach((payout) => {
      expect(total - payout).toBeGreaterThanOrEqual(total * 0.05);
    });
  });

  it('keeps original odds for an outcome nobody has bet on', () => {
    expect(adjustOddsForLiability([2, 3.4, 3.6], { home: 100, draw: 0, away: 100 }, 0.1)[1]).toBe(3.4);
  });
});
