import { useState } from 'react';
import { RefreshCw, Trophy, Newspaper, ListOrdered, AlertTriangle, ExternalLink } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useSportsData, SportsDataType, Game, StandingRow, Article } from '@/hooks/useSportsData';

const SPORTS = [
  { id: 'football', label: 'Football' },
  { id: 'basketball', label: 'Basketball' },
];
const TYPES: { id: SportsDataType; label: string; icon: typeof Trophy }[] = [
  { id: 'scores', label: 'Scores', icon: Trophy },
  { id: 'standings', label: 'Standings', icon: ListOrdered },
  { id: 'news', label: 'News', icon: Newspaper },
];

export default function SportsDashboardPage() {
  const [sport, setSport] = useState('football');
  const [type, setType] = useState<SportsDataType>('scores');
  const { data, loading, refreshing, refresh } = useSportsData(sport, type);
  const items = data?.items ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8 animate-fade-in">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Sports Center</p>
            <h1 className="mt-1 text-3xl font-bold md:text-4xl">Live sports</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data?.fetched_at ? `Updated ${new Date(data.fetched_at).toLocaleTimeString()}${data.source ? ` · ${data.source}` : ''}${data.stale ? ' · showing last saved' : ''}` : 'Fetching the latest…'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing || loading} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', (refreshing || loading) && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            {TYPES.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setType(id)}
                className={cn('flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all',
                  type === id ? 'bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.35)]' : 'text-muted-foreground hover:text-foreground')}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            {SPORTS.map((s) => (
              <button key={s.id} onClick={() => setSport(s.id)}
                className={cn('rounded-full px-4 py-1.5 text-sm font-medium transition-all',
                  sport === s.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? <Skeletons type={type} />
          : !data?.ok ? <EmptyState title="Couldn't load sports data" text={data?.error ?? 'Please try again shortly.'} onRetry={refresh} />
          : items.length === 0 ? <EmptyState title="Nothing here right now" text="The source returned no results. Try another sport or refresh." onRetry={refresh} />
          : type === 'scores' ? <GameGrid games={items as Game[]} />
          : type === 'standings' ? <Standings rows={items as StandingRow[]} />
          : <News articles={items as Article[]} />}
      </main>
      <Footer />
    </div>
  );
}

function StatusBadge({ status, clock }: { status: Game['status']; clock: string }) {
  if (status === 'live') return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-primary" /></span>
      LIVE{clock ? ` · ${clock}` : ''}
    </span>
  );
  if (status === 'final') return <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">FINAL</span>;
  return <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">SCHEDULED</span>;
}

function GameGrid({ games }: { games: Game[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {games.map((g) => (
        <article key={g.id} className="group rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.35)]">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">{g.league}</span>
            <StatusBadge status={g.status} clock={g.clock} />
          </div>
          {[['home', g.home_team, g.home_score], ['away', g.away_team, g.away_score]].map(([k, name, score]) => (
            <div key={k as string} className="flex items-center justify-between py-1.5">
              <span className="truncate pr-3 font-semibold">{name as string}</span>
              <span key={String(score)} className={cn('text-3xl font-black tabular-nums animate-fade-in', g.status === 'live' && 'text-primary')}>
                {score ?? '–'}
              </span>
            </div>
          ))}
          {g.game_date && <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{g.game_date}</p>}
        </article>
      ))}
    </div>
  );
}

function Standings({ rows }: { rows: StandingRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {rows[0]?.league && <div className="border-b border-border px-5 py-3 text-sm font-bold">{rows[0].league}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
            {['#', 'Team', 'P', 'W', 'D', 'L', 'Pts'].map((h, i) => <th key={h} className={cn('px-4 py-2.5 font-medium', i === 1 ? 'text-left' : 'text-center')}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team} className="border-b border-border/60 last:border-0 transition-colors hover:bg-secondary/40">
                <td className="px-4 py-2.5 text-center text-muted-foreground">{r.position}</td>
                <td className="px-4 py-2.5 font-semibold">{r.team}</td>
                {[r.played, r.won, r.drawn, r.lost].map((v, i) => <td key={i} className="px-4 py-2.5 text-center tabular-nums">{v ?? '–'}</td>)}
                <td className="px-4 py-2.5 text-center font-bold text-primary tabular-nums">{r.points ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function News({ articles }: { articles: Article[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {articles.map((a, i) => (
        <a key={i} href={a.url || undefined} target="_blank" rel="noreferrer"
          className="group rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary/40">
          <h3 className="font-bold leading-snug group-hover:text-primary">{a.title}</h3>
          {a.summary && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{a.summary}</p>}
          {a.url && <span className="mt-3 inline-flex items-center gap-1 text-xs text-primary">Read more <ExternalLink className="h-3 w-3" /></span>}
        </a>
      ))}
    </div>
  );
}

function Skeletons({ type }: { type: SportsDataType }) {
  if (type === 'standings') return <Skeleton className="h-96 w-full rounded-2xl" />;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
    </div>
  );
}

function EmptyState({ title, text, onRetry }: { title: string; text: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <AlertTriangle className="h-10 w-10 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>Try again</Button>
    </div>
  );
}
