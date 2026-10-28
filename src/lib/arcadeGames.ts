export type PlayingCard = { rank: string; suit: string };

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function drawCard(random: () => number = Math.random): PlayingCard {
  return {
    rank: RANKS[Math.floor(random() * RANKS.length)],
    suit: SUITS[Math.floor(random() * SUITS.length)],
  };
}

export function scoreBlackjackHand(hand: PlayingCard[]): number {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 'A') {
      total += 11;
      aces += 1;
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export function getRouletteColor(number: number): 'red' | 'black' | 'green' {
  if (number === 0) return 'green';
  const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  return redNumbers.has(number) ? 'red' : 'black';
}

export function scoreSlots(symbols: string[]): number {
  if (symbols.length !== 3) return 0;
  if (symbols.every((symbol) => symbol === symbols[0])) return 10;
  const counts = new Map<string, number>();
  symbols.forEach((symbol) => counts.set(symbol, (counts.get(symbol) ?? 0) + 1));
  return Math.max(...counts.values()) >= 2 ? 2 : 0;
}
