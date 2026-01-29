// LINKABET Types

export interface Team {
  id: string;
  name: string;
  logo?: string;
  score?: number;
}

export interface Odds {
  home: number;
  draw?: number;
  away: number;
}

export interface Match {
  id: string;
  sport: Sport;
  league: string;
  homeTeam: Team;
  awayTeam: Team;
  odds: Odds;
  startTime: Date;
  isLive: boolean;
  minute?: number;
}

export type Sport = 'football' | 'basketball' | 'tennis' | 'cricket' | 'esports' | 'mma';

export interface BetSelection {
  matchId: string;
  match: Match;
  selection: 'home' | 'draw' | 'away';
  odds: number;
}

export interface User {
  id: string;
  username: string;
  balance: number;
  currency: string;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  image?: string;
  badge?: string;
  ctaText: string;
}
