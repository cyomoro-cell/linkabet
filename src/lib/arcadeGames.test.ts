import { describe, expect, it } from 'vitest';
import { drawCard, getRouletteColor, scoreBlackjackHand, scoreSlots } from './arcadeGames';

describe('arcade game rules', () => {
  it('scores an ace as 1 when counting it as 11 would bust', () => {
    expect(scoreBlackjackHand([{ rank: 'A', suit: '♠' }, { rank: '9', suit: '♥' }, { rank: '5', suit: '♦' }])).toBe(15);
  });

  it('scores face cards as ten and preserves a soft ace when possible', () => {
    expect(scoreBlackjackHand([{ rank: 'A', suit: '♠' }, { rank: 'K', suit: '♥' }])).toBe(21);
  });

  it('draws a deterministic card when given a random source', () => {
    expect(drawCard(() => 0)).toEqual({ rank: 'A', suit: '♠' });
  });

  it('returns green for zero and known roulette colours for wheel numbers', () => {
    expect(getRouletteColor(0)).toBe('green');
    expect(getRouletteColor(1)).toBe('red');
    expect(getRouletteColor(2)).toBe('black');
  });

  it('awards score-only points for matching slot symbols', () => {
    expect(scoreSlots(['⭐', '⭐', '🍒'])).toBe(2);
    expect(scoreSlots(['💎', '💎', '💎'])).toBe(10);
    expect(scoreSlots(['🍋', '⭐', '🔔'])).toBe(0);
  });
});
