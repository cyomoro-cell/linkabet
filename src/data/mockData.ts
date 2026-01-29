import { Match, Promotion } from '@/types';

export const mockMatches: Match[] = [
  {
    id: '1',
    sport: 'football',
    league: 'Premier League',
    homeTeam: { id: 'mci', name: 'Manchester City', score: 2 },
    awayTeam: { id: 'liv', name: 'Liverpool', score: 1 },
    odds: { home: 1.85, draw: 3.50, away: 4.20 },
    startTime: new Date(),
    isLive: true,
    minute: 67,
  },
  {
    id: '2',
    sport: 'football',
    league: 'La Liga',
    homeTeam: { id: 'rma', name: 'Real Madrid' },
    awayTeam: { id: 'bar', name: 'Barcelona' },
    odds: { home: 2.10, draw: 3.30, away: 3.40 },
    startTime: new Date(Date.now() + 3600000),
    isLive: false,
  },
  {
    id: '3',
    sport: 'basketball',
    league: 'NBA',
    homeTeam: { id: 'lal', name: 'LA Lakers', score: 98 },
    awayTeam: { id: 'gsw', name: 'Golden State', score: 102 },
    odds: { home: 1.95, away: 1.90 },
    startTime: new Date(),
    isLive: true,
    minute: 42,
  },
  {
    id: '4',
    sport: 'tennis',
    league: 'ATP Masters',
    homeTeam: { id: 'djok', name: 'N. Djokovic' },
    awayTeam: { id: 'ala', name: 'C. Alcaraz' },
    odds: { home: 2.20, away: 1.75 },
    startTime: new Date(Date.now() + 7200000),
    isLive: false,
  },
  {
    id: '5',
    sport: 'football',
    league: 'Champions League',
    homeTeam: { id: 'bay', name: 'Bayern Munich' },
    awayTeam: { id: 'psg', name: 'Paris SG' },
    odds: { home: 1.70, draw: 3.80, away: 4.80 },
    startTime: new Date(Date.now() + 86400000),
    isLive: false,
  },
  {
    id: '6',
    sport: 'esports',
    league: 'LoL Worlds',
    homeTeam: { id: 't1', name: 'T1' },
    awayTeam: { id: 'geng', name: 'Gen.G' },
    odds: { home: 1.65, away: 2.30 },
    startTime: new Date(Date.now() + 10800000),
    isLive: false,
  },
];

export const mockPromotions: Promotion[] = [
  {
    id: '1',
    title: 'Welcome Bonus',
    description: 'Get 100% up to $500 on your first deposit',
    badge: 'NEW',
    ctaText: 'Claim Now',
  },
  {
    id: '2',
    title: 'Acca Boost',
    description: 'Get up to 50% extra on accumulators',
    badge: 'HOT',
    ctaText: 'Learn More',
  },
  {
    id: '3',
    title: 'Free Bet Club',
    description: 'Bet $50, Get $10 free bet every week',
    ctaText: 'Join Now',
  },
];

export const sportIcons: Record<string, string> = {
  football: '⚽',
  basketball: '🏀',
  tennis: '🎾',
  cricket: '🏏',
  esports: '🎮',
  mma: '🥊',
};
