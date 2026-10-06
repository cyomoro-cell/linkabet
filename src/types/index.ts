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
  country?: string;
  homeTeam: Team;
  awayTeam: Team;
  odds: Odds;
  startTime: Date;
  isLive: boolean;
  minute?: number;
  statusCode?: string;
}

export interface SportsFeedTeam {
  ID: string;
  Nm: string;
  Img?: string;
  Abr?: string;
}

export interface SportsFeedEvent {
  Eid: string;
  T1: SportsFeedTeam[];
  T2: SportsFeedTeam[];
  Eps: string;
  Est: number;
  Spid?: number;
  Tr1?: string;
  Tr2?: string;
}

export interface SportsFeedLeague {
  Sid: string;
  Snm: string;
  Cnm: string;
  Scd?: string;
  Ccd?: string;
  Evs: SportsFeedEvent[];
}

export interface SportsFeedSection {
  Id: string;
  Tp: number;
  Ts: SportsFeedLeague;
}

export interface SportsFeed {
  Ts: number;
  Nav: { Hn: boolean; Hp: boolean };
  Sctns: SportsFeedSection[];
}

export type Sport = 'football' | 'soccer' | 'basketball' | 'tennis' | 'cricket' | 'esports' | 'mma' | 'rugby' | 'american football' | 'ice hockey' | 'baseball';

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
  endsAt?: string;
}
