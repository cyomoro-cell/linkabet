import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CircleHelp, Dices, Gamepad2, RotateCcw, Spade, Sparkles, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { scoreBlackjackHand, scoreSlots, type PlayingCard, drawCard, getRouletteColor } from '@/lib/arcadeGames';

type GameId = 'roulette' | 'blackjack' | 'slots' | 'crash';

const games: { id: GameId; name: string; tagline: string; icon: typeof Dices; accent: string }[] = [
  { id: 'roulette', name: 'Roulette', tagline: 'Pick a colour. Spin for fun.', icon: Dices, accent: 'from-rose-500/20 to-red-950/40' },
  { id: 'blackjack', name: 'Blackjack', tagline: 'Get close to 21 without going over.', icon: Spade, accent: 'from-emerald-500/20 to-emerald-950/40' },
  { id: 'slots', name: 'Slots', tagline: 'Match symbols in the arcade.', icon: Sparkles, accent: 'from-amber-500/20 to-orange-950/40' },
  { id: 'crash', name: 'Crash Run', tagline: 'How long can your rocket stay airborne?', icon: Zap, accent: 'from-sky-500/20 to-blue-950/40' },
];

const cardLabel = (card: PlayingCard) => `${card.rank}${card.suit}`;
const cardValue = (card: PlayingCard) => card.rank === 'A' ? 11 : ['K', 'Q', 'J'].includes(card.rank) ? 10 : Number(card.rank);

export default function CasinoPage() {
  const [activeGame, setActiveGame] = useState<GameId>('roulette');
  const [scores, setScores] = useState<Record<GameId, number>>({ roulette: 0, blackjack: 0, slots: 0, crash: 0 });
  const [roulettePick, setRoulettePick] = useState<'red' | 'black' | 'green'>('red');
  const [rouletteResult, setRouletteResult] = useState<number | null>(null);
  const [rouletteMessage, setRouletteMessage] = useState('Choose a colour, then spin.');
  const [hand, setHand] = useState<PlayingCard[]>([]);
  const [handMessage, setHandMessage] = useState('Start a round to deal your cards.');
  const [handOver, setHandOver] = useState(true);
  const [slotResult, setSlotResult] = useState<string[]>(['🍒', '⭐', '🔔']);
  const [slotMessage, setSlotMessage] = useState('Spin to match symbols and earn arcade points.');
  const [crashRunning, setCrashRunning] = useState(false);
  const [crashValue, setCrashValue] = useState(1);
  const [crashMessage, setCrashMessage] = useState('Launch the rocket and brake before it bursts.');
  const crashRef = useRef({ value: 1, limit: 2.2, running: false });

  useEffect(() => {
    if (!crashRunning) return;
    const timer = window.setInterval(() => {
      const next = Number((crashRef.current.value + 0.05).toFixed(2));
      crashRef.current.value = next;
      setCrashValue(next);
      if (next >= crashRef.current.limit) {
        crashRef.current.running = false;
        setCrashRunning(false);
        setCrashMessage('The rocket burst! Try another flight.');
      }
    }, 120);
    return () => window.clearInterval(timer);
  }, [crashRunning]);

  const addScore = (id: GameId, points: number) => {
    setScores((current) => ({ ...current, [id]: current[id] + points }));
  };

  const spinRoulette = () => {
    const number = Math.floor(Math.random() * 37);
    const color = getRouletteColor(number);
    setRouletteResult(number);
    if (color === roulettePick) {
      addScore('roulette', 10);
      setRouletteMessage(`Nice pick — ${color} earns 10 arcade points!`);
    } else {
      setRouletteMessage(`It landed on ${color}. No points this spin — try again.`);
    }
  };

  const startBlackjack = () => {
    const next = [drawCard(), drawCard()];
    setHand(next);
    const total = scoreBlackjackHand(next);
    setHandOver(total >= 21);
    setHandMessage(total === 21 ? '21! Perfect opening hand — start a new round.' : `Your total is ${total}. Draw or stand.`);
    if (total === 21) addScore('blackjack', 10);
  };

  const hitBlackjack = () => {
    if (handOver || hand.length === 0) return;
    const next = [...hand, drawCard()];
    setHand(next);
    const total = scoreBlackjackHand(next);
    if (total > 21) {
      setHandOver(true);
      setHandMessage(`Bust at ${total}. Start a new round to play again.`);
    } else if (total === 21) {
      setHandOver(true);
      addScore('blackjack', 10);
      setHandMessage('21! You earned 10 arcade points.');
    } else {
      setHandMessage(`Your total is ${total}. Draw or stand.`);
    }
  };

  const standBlackjack = () => {
    if (handOver || hand.length === 0) return;
    const total = scoreBlackjackHand(hand);
    setHandOver(true);
    if (total >= 17) {
      addScore('blackjack', 5);
      setHandMessage(`You stood on ${total}. Solid round — 5 arcade points!`);
    } else {
      setHandMessage(`You stood on ${total}. Try getting a little closer to 21 next round.`);
    }
  };

  const spinSlots = () => {
    const symbols = ['🍒', '🍋', '⭐', '🔔', '💎', '🍀'];
    const result = Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
    setSlotResult(result);
    const points = scoreSlots(result);
    addScore('slots', points);
    setSlotMessage(points ? `Match! You earned ${points} arcade points.` : 'No match this time. Spin again!');
  };

  const launchCrash = () => {
    crashRef.current = { value: 1, limit: Number((1.5 + Math.random() * 3.5).toFixed(2)), running: true };
    setCrashValue(1);
    setCrashRunning(true);
    setCrashMessage('Rocket launched! Press Brake to bank your arcade score.');
  };

  const brakeCrash = () => {
    if (!crashRef.current.running) return;
    const points = Math.max(1, Math.floor(crashRef.current.value * 5));
    crashRef.current.running = false;
    setCrashRunning(false);
    addScore('crash', points);
    setCrashMessage(`Safe landing at ${crashRef.current.value.toFixed(2)}× — ${points} arcade points earned.`);
  };

  const resetScores = () => setScores({ roulette: 0, blackjack: 0, slots: 0, crash: 0 });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="container flex-1 py-8 md:py-10">
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" aria-label="Back to home"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Gamepad2 className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Linkabet Arcade</p>
            <h1 className="text-3xl font-black md:text-4xl">Game lobby</h1>
            <p className="mt-1 text-sm text-muted-foreground">Four quick-play demos. Just for fun, with no stakes.</p>
          </div>
          <Button variant="outline" size="sm" onClick={resetScores} className="gap-2"><RotateCcw className="h-4 w-4" /> Reset scores</Button>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">
          <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-muted-foreground"><strong className="text-foreground">Arcade rules:</strong> scores are local to this page and have no cash value. No wallet, deposits, withdrawals, stakes, or prizes are connected to these demos.</p>
        </div>

        <section aria-label="Game selection" className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {games.map((game) => {
            const Icon = game.icon;
            return (
              <button key={game.id} onClick={() => setActiveGame(game.id)} aria-pressed={activeGame === game.id}
                className={cn('group rounded-2xl border bg-gradient-to-br p-4 text-left transition-all hover:-translate-y-0.5', game.accent,
                  activeGame === game.id ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]' : 'border-border hover:border-primary/40')}>
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/70"><Icon className="h-5 w-5" /></span>
                  <span className="rounded-full bg-background/70 px-2.5 py-1 text-xs font-bold tabular-nums">{scores[game.id]} pts</span>
                </div>
                <h2 className="text-lg font-bold">{game.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{game.tagline}</p>
              </button>
            );
          })}
        </section>

        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
          {activeGame === 'roulette' && <div className="grid gap-8 p-5 md:grid-cols-[0.9fr_1.1fr] md:p-8">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-rose-950/60 to-background p-6 text-center">
              <div className={cn('mb-5 flex h-36 w-36 items-center justify-center rounded-full border-8 border-amber-300/70 text-5xl font-black shadow-[0_0_50px_hsl(45_93%_58%/0.12)] transition-transform', rouletteResult !== null && 'animate-scale-in',
                rouletteResult === 0 ? 'bg-emerald-600' : rouletteResult !== null && getRouletteColor(rouletteResult) === 'red' ? 'bg-rose-600' : 'bg-slate-800')}>
                {rouletteResult ?? '🎯'}
              </div>
              <p className="text-sm text-muted-foreground">Latest spin</p>
              <p className="mt-2 font-semibold" role="status">{rouletteMessage}</p>
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Demo 01</p>
              <h2 className="mt-1 text-2xl font-black">Roulette</h2>
              <p className="mt-2 text-sm text-muted-foreground">Choose a colour and spin. A correct guess earns 10 arcade points; there is no point deduction for a miss.</p>
              <div className="my-6 grid grid-cols-3 gap-3">
                {(['red', 'black', 'green'] as const).map((color) => <button key={color} onClick={() => setRoulettePick(color)} aria-pressed={roulettePick === color}
                  className={cn('rounded-xl border p-3 text-sm font-bold capitalize transition-all', color === 'red' ? 'bg-rose-600/20' : color === 'black' ? 'bg-slate-950' : 'bg-emerald-600/20',
                    roulettePick === color ? 'border-primary ring-2 ring-primary/30' : 'border-border')}>{color}</button>)}
              </div>
              <Button onClick={spinRoulette} className="w-full">Spin wheel</Button>
            </div>
          </div>}

          {activeGame === 'blackjack' && <div className="grid gap-8 p-5 md:grid-cols-[0.9fr_1.1fr] md:p-8">
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-950/70 to-background p-6">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-emerald-300">Your hand</p>
              <div className="flex flex-wrap justify-center gap-2">
                {hand.map((card, index) => <div key={index} className="flex h-24 w-16 flex-col justify-between rounded-lg border border-border bg-white p-2 text-slate-950 shadow-lg"><span className="text-lg font-black">{card.rank}</span><span className="text-center text-2xl">{card.suit}</span><span className="rotate-180 text-lg font-black">{card.rank}</span></div>)}
                {hand.length === 0 && <div className="flex h-24 w-16 items-center justify-center rounded-lg border border-dashed border-emerald-300/40 text-3xl text-emerald-200">?</div>}
              </div>
              <p className="mt-5 text-sm text-muted-foreground">Hand total</p>
              <p className="text-4xl font-black tabular-nums">{hand.length ? scoreBlackjackHand(hand) : '—'}</p>
              <p className="mt-3 text-center text-sm" role="status">{handMessage}</p>
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Demo 02</p>
              <h2 className="mt-1 text-2xl font-black">Blackjack</h2>
              <p className="mt-2 text-sm text-muted-foreground">A simple card-drawing challenge. Reach 21 for 10 points or stand on 17+ for 5 points. Aces adjust to keep the hand score sensible.</p>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Button onClick={startBlackjack}>New hand</Button>
                <Button variant="outline" onClick={hitBlackjack} disabled={handOver}>Draw card</Button>
                <Button variant="outline" onClick={standBlackjack} disabled={handOver || hand.length === 0}>Stand</Button>
              </div>
            </div>
          </div>}

          {activeGame === 'slots' && <div className="grid gap-8 p-5 md:grid-cols-[0.9fr_1.1fr] md:p-8">
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-amber-950/60 to-background p-6">
              <div className="flex gap-2 rounded-2xl border border-amber-300/20 bg-black/30 p-4 sm:gap-4 sm:p-6">
                {slotResult.map((symbol, index) => <div key={index} className="flex h-20 w-16 items-center justify-center rounded-xl bg-white text-4xl shadow-inner sm:h-24 sm:w-20 sm:text-5xl">{symbol}</div>)}
              </div>
              <p className="mt-5 text-center text-sm" role="status">{slotMessage}</p>
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Demo 03</p>
              <h2 className="mt-1 text-2xl font-black">Slots Arcade</h2>
              <p className="mt-2 text-sm text-muted-foreground">Match two symbols for 2 points or all three for 10. Each spin is free and your score never decreases.</p>
              <div className="mt-6"><Button onClick={spinSlots} className="w-full">Spin reels</Button></div>
            </div>
          </div>}

          {activeGame === 'crash' && <div className="grid gap-8 p-5 md:grid-cols-[0.9fr_1.1fr] md:p-8">
            <div className="relative flex min-h-64 flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-sky-950 to-background p-6">
              <div className="absolute inset-x-0 bottom-10 h-px bg-sky-300/30" />
              <div className={cn('mb-4 text-6xl transition-transform', crashRunning && 'animate-float')}>🚀</div>
              <p className="text-5xl font-black tabular-nums text-sky-300">{crashValue.toFixed(2)}×</p>
              <p className="mt-3 text-center text-sm" role="status">{crashMessage}</p>
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Demo 04</p>
              <h2 className="mt-1 text-2xl font-black">Crash Run</h2>
              <p className="mt-2 text-sm text-muted-foreground">An arcade timing challenge with no stake: launch a rocket and brake before the random burst. Safe landings award score points only.</p>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button onClick={launchCrash} disabled={crashRunning}>Launch rocket</Button>
                <Button variant="outline" onClick={brakeCrash} disabled={!crashRunning}>Brake</Button>
              </div>
            </div>
          </div>}
        </section>

        <p className="mt-5 text-center text-xs text-muted-foreground">Demo scores reset when you leave or refresh this page. They are not connected to your Linkabet wallet.</p>
      </main>
      <Footer />
    </div>
  );
}
