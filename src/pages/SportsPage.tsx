import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/supabase';
import { Search, LayoutList, LayoutGrid, Trash2, X, Calendar, Receipt } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { MatchRow, SportsMatch } from '@/components/sports/MatchRow';
import { useBetSlip } from '@/hooks/useBetSlip';
import { toast } from 'sonner';
import { useFootballMatches } from '@/hooks/useFootballMatches';

const SPORTS = [
  { id: 'football', label: 'Soccer', icon: '⚽', count: 24 },
  { id: 'basketball', label: 'Basketball', icon: '🏀', count: 8 },
  { id: 'tennis', label: 'Tennis', icon: '🎾', count: 12 },
  { id: 'american football', label: 'Football', icon: '🏈', count: 5 },
  { id: 'esports', label: 'Esports', icon: '🎮', count: 3 },
];
const FILTERS = ['Live Now', 'Popular', 'Upcoming', 'All'] as const;

export default function SportsPage() {
  const [sport, setSport] = useState('football');
  const [params] = useSearchParams();
  const tab = params.get('tab');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(tab === 'live' ? 'Live Now' : tab === 'popular' ? 'Popular' : tab === 'upcoming' ? 'Upcoming' : 'All');
  const [q, setQ] = useState('');
  const [date, setDate] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');

  const { data: realMatches, isLoading, isError } = useFootballMatches();
  const MATCHES = realMatches ?? [];
  const groups = useMemo(() => {
    const list = MATCHES.filter((m) => m.sport === sport)
      .filter((m) => filter === 'All' || (filter === 'Live Now' ? m.live : filter === 'Popular' ? m.popular : !m.live))
      .filter((m) => !q || `${m.home} ${m.away} ${m.league}`.toLowerCase().includes(q.toLowerCase()))
      .filter((m) => !date || m.startTime.toISOString().slice(0, 10) === date);
    const map = new Map<string, SportsMatch[]>();
    list.forEach((m) => map.set(m.league, [...(map.get(m.league) ?? []), m]));
    return [...map.entries()];
  }, [MATCHES, sport, filter, q, date]);

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
              <span className="rounded-md bg-secondary px-1.5 text-[11px]">{MATCHES.filter((m) => m.sport === s.id).length}</span>
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

          <div className="mb-4 flex gap-2 overflow-x-auto">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors',
                  filter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
                {f === 'Live Now' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />}
                {f} <span className="opacity-70">{MATCHES.filter((m) => m.sport === sport && (f === 'All' || (f === 'Live Now' ? m.live : f === 'Popular' ? m.popular : !m.live))).length}</span>
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
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">{isLoading ? 'Loading real matches…' : isError ? 'Could not load matches right now. Retrying soon.' : 'No matches for this filter.'}</div>
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

        <aside className="hidden w-[22rem] shrink-0 lg:block">
          <div className="fixed right-4 top-24 z-40 h-[calc(100vh-7rem)] w-80 rounded-2xl border border-primary/30 bg-card/90 p-4 shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.35)] backdrop-blur-xl animate-in fade-in slide-in-from-right-6 duration-500">
            <SportsBetSlip />
          </div>
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
  const disabled = placing || selections.length === 0 || totalStake <= 0 || mode === 'System';
  const { user, wallet, refreshWallet } = useAuth();
  const navigate = useNavigate();
  const [placing, setPlacing] = useState(false);
  const toSel = (s: typeof selections[number]) => ({ matchId: s.matchId, selection: s.selection, odds: s.odds, homeTeam: s.match.homeTeam.name, awayTeam: s.match.awayTeam.name });

  async function placeBet() {
    if (!user) return navigate('/auth');
    const balance = Number(wallet?.balance ?? 0);
    if (totalStake > balance) return toast.error('Not enough balance');
    const rows = mode === 'Singles'
      ? selections.filter((s) => (stakes[s.matchId] ?? 0) > 0).map((s) => ({ s: [s], stake: stakes[s.matchId], odds: s.odds }))
      : [{ s: selections, stake, odds: totalOdds }];
    setPlacing(true);
    try {
      for (const r of rows) {
        const first = r.s[0].match;
        const { error } = await db.from('bets').insert({
          user_id: user.id, match_id: r.s[0].matchId,
          match_data: { homeTeam: first.homeTeam, awayTeam: first.awayTeam, league: first.league, sport: first.sport },
          selections: r.s.map(toSel), stake: r.stake, total_odds: r.odds, potential_win: r.stake * r.odds,
        } as any);
        if (error) throw error;
        await db.from('transactions').insert({ user_id: user.id, type: 'bet', amount: r.stake, fee: 0, net_amount: r.stake, status: 'approved', description: `Bet on ${first.homeTeam.name} vs ${first.awayTeam.name}` } as any);
      }
      const { error: we } = await db.from('wallets').update({ balance: balance - totalStake, updated_at: new Date().toISOString() }).eq('user_id', user.id);
      if (we) throw we;
      await refreshWallet();
      toast.success(`Bet placed! Potential payout ${payout.toFixed(2)}`);
      clearAll(); setStakes({});
    } catch (e: any) {
      toast.error(e.message ?? 'Could not place bet');
    } finally { setPlacing(false); }
  }

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
        {selections.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Click on odds to add selections</p>}
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
        {mode === 'System' && <p className="text-xs text-muted-foreground">System bets are coming soon. Use Singles or Accumulator.</p>}
        <div className="flex justify-between text-muted-foreground"><span>Total odds</span><span className="font-semibold text-foreground">{selections.length ? totalOdds.toFixed(2) : '–'}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Total stake</span><span className="font-semibold text-foreground">{totalStake.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Potential payout</span><span className="font-bold text-primary">{payout.toFixed(2)}</span></div>
        <Button variant="hero" className="w-full" disabled={disabled}
          onClick={placeBet}>
          {placing ? 'Placing…' : user ? 'Place Bet' : 'Sign in to bet'}
        </Button>
      </div>
    </div>
  );
}
