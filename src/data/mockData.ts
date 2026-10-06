import { Match, Promotion, Sport, SportsFeed } from '@/types';

const nowSeconds = Math.floor(Date.now() / 1000);

// Mock fixtures intentionally mirror the supplied Sctns[] → Ts → Evs[] feed.
export const mockSportsFeed: SportsFeed = {
  Ts: nowSeconds,
  Nav: { Hn: true, Hp: false },
  Sctns: [
    {
      Id: 's-25695',
      Tp: 1,
      Ts: {
        Sid: '25695',
        Snm: 'LaLiga',
        Scd: 'laliga',
        Cnm: 'Spain',
        Ccd: 'spain',
        Evs: [
          {
            Eid: '1810672',
            T1: [{ ID: '4253', Nm: 'Rayo Vallecano', Abr: 'RAY' }],
            T2: [{ ID: '12635', Nm: 'Espanyol', Abr: 'ESY' }],
            Eps: 'NS',
            Est: nowSeconds + 3600,
            Spid: 1,
          },
          {
            Eid: '1810658',
            T1: [{ ID: '8633', Nm: 'Real Sociedad', Abr: 'RSO' }],
            T2: [{ ID: '9906', Nm: 'Villarreal', Abr: 'VIL' }],
            Eps: 'NS',
            Est: nowSeconds + 7200,
            Spid: 1,
          },
        ],
      },
    },
    {
      Id: 's-17',
      Tp: 1,
      Ts: {
        Sid: '17',
        Snm: 'Premier League',
        Scd: 'premier-league',
        Cnm: 'England',
        Ccd: 'england',
        Evs: [
          {
            Eid: 'mock-live-1',
            T1: [{ ID: 'mci', Nm: 'Manchester City', Abr: 'MCI' }],
            T2: [{ ID: 'liv', Nm: 'Liverpool', Abr: 'LIV' }],
            Eps: '67',
            Est: nowSeconds - 4020,
            Spid: 1,
            Tr1: '2',
            Tr2: '1',
          },
        ],
      },
    },
  ],
};

const scoreFromFeed = (score?: string) => {
  if (score === undefined) return undefined;
  const value = Number(score);
  return Number.isFinite(value) ? value : undefined;
};

export function sportsFeedToMatches(feed: SportsFeed): Match[] {
  return feed.Sctns.flatMap(({ Ts: league }) =>
    league.Evs.flatMap((event) => {
      const home = event.T1[0];
      const away = event.T2[0];
      if (!home || !away) return [];

      const isUpcoming = event.Eps === 'NS';
      const minute = !isUpcoming ? Number.parseInt(event.Eps, 10) : undefined;
      return [{
        id: event.Eid,
        sport: 'football' as Sport,
        league: league.Snm,
        country: league.Cnm,
        homeTeam: { id: home.ID, name: home.Nm, score: scoreFromFeed(event.Tr1) },
        awayTeam: { id: away.ID, name: away.Nm, score: scoreFromFeed(event.Tr2) },
        odds: { home: 1.85, draw: 3.4, away: 4.1 },
        startTime: new Date(event.Est * 1000),
        isLive: !isUpcoming,
        minute: Number.isFinite(minute) ? minute : undefined,
        statusCode: event.Eps,
      }];
    }),
  );
}

export const mockMatches: Match[] = sportsFeedToMatches(mockSportsFeed);

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
    endsAt: new Date(Date.now() + (2 * 24 + 14) * 3600_000).toISOString(),
  },
  {
    id: '3',
    title: 'Free Bet Club',
    description: 'Bet $50, Get $10 free bet every week',
    ctaText: 'Join Now',
    endsAt: new Date(Date.now() + 5 * 24 * 3600_000).toISOString(),
  },
];

export const sportIcons: Record<string, string> = {
  football: '⚽',
  soccer: '⚽',
  basketball: '🏀',
  tennis: '🎾',
  cricket: '🏏',
  esports: '🎮',
  mma: '🥊',
  rugby: '🏉',
  'american football': '🏈',
  'ice hockey': '🏒',
  baseball: '⚾',
};
