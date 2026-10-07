import { useMemo, useState } from 'react';
import { Search, LayoutList, LayoutGrid, Trash2, X, Calendar, Receipt } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { MatchRow, SportsMatch } from '@/components/sports/MatchRow';
import { useBetSlip } from '@/hooks/useBetSlip';
import { toast } from 'sonner';

const at = (h: number, m = 0, dayOffset = 0) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d; };

const MATCHES: SportsMatch[] = [
  { id: 's1', sport: 'football', league: 'Rwanda Premier League', home: 'APR', away: 'Rayon Sports', startTime: at(17), live: true, minute: 78, homeScore: 2, awayScore: 1, odds: { home: 1.45, draw: 3.9, away: 6.5 } },
  { id: 's2', sport: 'football', league: 'Rwanda Premier League', home: 'Police FC', away: 'Kiyovu', startTime: at(19), live: false, odds: { home: 2.1, draw: 3.4, away: 2.8 } },
  { id: 's3', sport: 'football', league: 'Rwanda Premier League', home: 'Mukura VS', away: 'AS Kigali', startTime: at(15, 30, 1), live: false, odds: { home: 2.45, draw: 3.1, away: 2.6 } },
  { id: 's4', sport: 'football', league: 'Champions League', home: 'Arsenal', away: 'Chelsea', startTime: at(21), live: true, minute: 54, homeScore: 1, awayScore: 1, odds: { home: 2.3, draw: 2.9, away: 3.6 } },
  { id: 's5', sport: 'football', league: 'Champions League', home: 'Real Madrid', away: 'Barcelona', startTime: at(21), live: false, odds: { home: 2.05, draw: 3.6, away: 3.3 } },
  { id: 's6', sport: 'basketball', league: 'Rwanda Basketball League', home: 'REG', away: 'Patriots', startTime: at(18), live: true, minute: 36, homeScore: 78, awayScore: 72, odds: { home: 1.35, away: 3.1 } },
  { id: 's7', sport: 'basketball', league: 'NBA', home: 'Lakers', away: 'Celtics', startTime: at(2, 30, 1), live: false, odds: { home: 1.95, away: 1.85 } },
  { id: 's8', sport: 'tennis', league: 'ATP Finals', home: 'N. Djokovic', away: 'C. Alcaraz', startTime: at(16), live: true, minute: 72, homeScore: 1, awayScore: 0, odds: { home: 1.6, away: 2.3 } },
  { id: 's9', sport: 'tennis', league: 'WTA Finals', home: 'I. Swiatek', away: 'A. Sabalenka', startTime: at(20), live: false, odds: { home: 1.75, away: 2.05 } },
  { id: 's10', sport: 'esports', league: 'LoL Worlds', home: 'T1', away: 'Gen.G', startTime: at(13, 0, 1), live: false, odds: { home: 1.7, away: 2.1 } },
  { id: 's11', sport: 'american football', league: 'NFL', home: 'Chiefs', away: 'Eagles', startTime: at(1, 15, 1), live: false, odds: { home: 1.8, away: 2.0 } },
];

const SPORTS = [
  { id: 'football', label: 'Soccer', icon: '⚽', count: 24 },
  { id: 'basketball', label: 'Basketball', icon: '🏀', count: 8 },
  { id: 'tennis', label: 'Tennis', icon: '🎾', count: 12 },
  { id: 'american football', label: 'Football', icon: '🏈', count: 5 },
  { id: 'esports', label: 'Esports', icon: '🎮', count: 3 },
];
const FILTERS = ['Live Now', 'Today', 'Upcoming', 'All'] as const;

export default function SportsPage() {
  const [sport, setSport] = useState('football');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [q, setQ] = useState('');
  const [date, setDate] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');

  const groups = useMemo(() => {
    const today = new Date().toDateString();
    const list = MATCHES.filter((m) => m.sport === sport)
      .filter((m) => filter === 'All' || (filter === 'Live Now' ? m.live : filter === 'Today' ? m.startTime.toDateString() === today : !m.live))
      .filter((m) => !q || `${m.home} ${m.away} ${m.league}`.toLowerCase().includes(q.toLowerCase()))
      .filter((m) => !date || m.startTime.toISOString().slice(0, 10) === date);
    const map = new Map<string, SportsMatch[]>();
    list.forEach((m) => map.set(m.league, [...(map.get(m.league) ?? []), m]));
    return [...map.entries()];
  }, [sport, filter, q, date]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 overflow-y-auto border-r border-border bg-card/40 p-3 md:block">
          <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Sports</p>
          {SPORTS.map((s) => (
            <button key={s.id} onClick={() => setSport(s.id)}
              className={cn('mb-1 flex w-full items-center gap-3 rounded-r-lg border-l-2 px-3 py-2.5 text-sm transition-colors',
                sport === s.id ? 'border-primary bg-primary/10 font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground')}>
              <span className="text-base">{s.icon}</span>
              <span className="flex-1 text-left">{s.label}</span>
              <span className="rounded-md bg-secondary px-1.5 text-[11px]">{s.count}</span>
            </button>
          ))}
          <p className="mb-2 mt-6 px-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Show</p>
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm',
                filter === f ? 'bg-secondary font-semibold' : 'text-muted-foreground hover:text-foreground')}>
              {f === 'Live Now' && <span className="h-2 w-2 animate-pulse rounded-full bg-live" />}
              {f}
            </button>
          ))}
        </aside>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
            {SPORTS.map((s) => (
              <button key={s.id} onClick={() => setSport(s.id)}
                className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs', sport === s.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams or leagues" className="pl-9" />
            </div>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44 pl-9" />
            </div>
            <div className="flex rounded-lg border border-border p-1">
              {(['list', 'grid'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} aria-label={`${v} view`}
                  className={cn('rounded-md p-1.5', view === v ? 'bg-secondary text-foreground' : 'text-muted-foreground')}>
                  {v === 'list' ? <LayoutList className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">No matches for this filter.</div>
          ) : (
            <div className="space-y-5">
              {groups.map(([league, rows]) => (
                <section key={league} className="overflow-hidden rounded-xl border border-border bg-card">
                  <header className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-3">
                    <h2 className="text-sm font-bold">{league}</h2>
                    <span className="text-xs text-muted-foreground">{rows.length} matches</span>
                  </header>
                  <div className={cn(view === 'grid' && 'grid gap-3 p-3 sm:grid-cols-2')}>
                    {rows.map((m) => <MatchRow key={m.id} match={m} view={view} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>

        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-80 shrink-0 border-l border-border bg-card/40 p-4 lg:block">
          <SportsBetSlip />
        </aside>
      </div>

      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="hero" size="lg" className="fixed bottom-6 right-4 z-50 rounded-full shadow-xl"><Receipt className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-4"><SportsBetSlip /></SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

const MODES = ['Singles', 'Accumulator', 'System'] as const;
const marketLabel = { home: 'Home win', draw: 'Draw', away: 'Away win' };

function SportsBetSlip() {
  const { selections, removeSelection, clearAll, stake, setStake } = useBetSlip();
  const [mode, setMode] = useState<(typeof MODES)[number]>('Singles');
  const [stakes, setStakes] = useState<Record<string, number>>({});

  const totalOdds = selections.reduce((a, s) => a * s.odds, 1);
  let totalStake = 0, payout = 0;
  if (mode === 'Singles') {
    selections.forEach((s) => { const st = stakes[s.matchId] ?? 0; totalStake += st; payout += st * s.odds; });
  } else if (mode === 'Accumulator') {
    totalStake = stake; payout = selections.length ? stake * totalOdds : 0;
  } else {
    // System: all doubles (pairs), stake per combination.
    const pairs: number[] = [];
    for (let i = 0; i < selections.length; i++) for (let j = i + 1; j < selections.length; j++) pairs.push(selections[i].odds * selections[j].odds);
    totalStake = stake * pairs.length; payout = pairs.reduce((a, o) => a + o * stake, 0);
  }
  const disabled = selections.length === 0 || totalStake <= 0 || (mode === 'System' && selections.length < 3);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold">Bet Slip <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{selections.length}</span></h2>
        {selections.length > 0 && (
          <button onClick={clearAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-live"><Trash2 className="h-3.5 w-3.5" /> Clear all</button>
        )}
      </div>
      <div className="mb-3 grid grid-cols-3 rounded-lg bg-secondary/60 p-1">
        {MODES.map((m) => (
          <button key={m} onClick={() => setMode(m)} className={cn('rounded-md py-1.5 text-xs font-semibold', mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{m}</button>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {selections.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Tap any odds to add a selection.</p>}
        {selections.map((s) => (
          <div key={s.matchId} className="rounded-lg border border-border bg-secondary/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{s.match.homeTeam.name} vs {s.match.awayTeam.name}</p>
                <p className="text-sm font-semibold">{marketLabel[s.selection]}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary">{s.odds.toFixed(2)}</span>
                <button onClick={() => removeSelection(s.matchId)} aria-label="Remove"><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
              </div>
            </div>
            {mode === 'Singles' && (
              <Input type="number" min={0} placeholder="Stake" className="mt-2 h-8" value={stakes[s.matchId] ?? ''}
                onChange={(e) => setStakes((st) => ({ ...st, [s.matchId]: Math.max(0, Number(e.target.value)) }))} />
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
        {mode !== 'Singles' && (
          <div>
            <label className="text-xs text-muted-foreground">{mode === 'System' ? 'Stake per double' : 'Total stake'}</label>
            <Input type="number" min={0} value={stake} onChange={(e) => setStake(Math.max(0, Number(e.target.value)))} className="mt-1 h-9" />
          </div>
        )}
        {mode === 'System' && selections.length < 3 && <p className="text-xs text-muted-foreground">System bets need at least 3 selections.</p>}
        <div className="flex justify-between text-muted-foreground"><span>Total odds</span><span className="font-semibold text-foreground">{selections.length ? totalOdds.toFixed(2) : '–'}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Total stake</span><span className="font-semibold text-foreground">{totalStake.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Potential payout</span><span className="font-bold text-primary">{payout.toFixed(2)}</span></div>
        <Button variant="hero" className="w-full" disabled={disabled}
          onClick={() => { toast.success('Bet placed!'); clearAll(); setStakes({}); }}>
          Place Bet
        </Button>
      </div>
    </div>
  );
}
