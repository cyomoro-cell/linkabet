import { useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  AudioLines,
  Gamepad2,
  Grid2X2,
  Search,
  Sparkles,
  Trophy,
  Zap,
  X,
  Puzzle,
  CircleDot,
  Orbit,
  Layers3,
  Star,
} from 'lucide-react';
import { Link } from 'react-router-dom';

type Category = 'All games' | 'Arcade' | 'Puzzle' | 'Strategy' | 'Memory' | 'Reflex';

type ArcadeGame = {
  id: string;
  title: string;
  subtitle: string;
  category: Exclude<Category, 'All games'>;
  icon: typeof Gamepad2;
  palette: string;
  tag?: string;
  description: string;
};

const games: ArcadeGame[] = [
  {
    id: 'neon-grid',
    title: 'Neon Grid',
    subtitle: 'Memory • Quick rounds',
    category: 'Puzzle',
    icon: Grid2X2,
    palette: 'from-cyan-400/30 via-blue-500/20 to-indigo-600/40',
    tag: 'Popular',
    description: 'Remember the highlighted tile and build your streak. A quick memory challenge with no purchases or stakes.',
  },
  {
    id: 'orbit-dash',
    title: 'Orbit Dash',
    subtitle: 'Arcade • Reflexes',
    category: 'Arcade',
    icon: Orbit,
    palette: 'from-violet-500/40 via-fuchsia-500/20 to-blue-500/30',
    tag: 'New',
    description: 'Test your focus in a fast, space-inspired reaction challenge.',
  },
  {
    id: 'tile-tactics',
    title: 'Tile Tactics',
    subtitle: 'Strategy • Planning',
    category: 'Strategy',
    icon: Layers3,
    palette: 'from-emerald-400/30 via-teal-500/20 to-cyan-600/30',
    description: 'Plan a few moves ahead and see how long you can keep your board clear.',
  },
  {
    id: 'prism-pairs',
    title: 'Prism Pairs',
    subtitle: 'Puzzle • Matching',
    category: 'Puzzle',
    icon: Puzzle,
    palette: 'from-pink-500/30 via-rose-500/20 to-orange-400/30',
    description: 'Find matching symbols and improve your best time in this colorful memory game.',
  },
  {
    id: 'pulse-runner',
    title: 'Pulse Runner',
    subtitle: 'Arcade • Timing',
    category: 'Arcade',
    icon: Zap,
    palette: 'from-amber-400/30 via-orange-500/20 to-red-500/30',
    description: 'Choose the right moment to move through a series of glowing gates.',
  },
  {
    id: 'orbit-logic',
    title: 'Orbit Logic',
    subtitle: 'Strategy • Logic',
    category: 'Strategy',
    icon: CircleDot,
    palette: 'from-sky-400/30 via-indigo-500/20 to-purple-500/30',
    description: 'Solve compact logic challenges and collect achievement badges.',
  },
  { id: 'color-cascade', title: 'Color Cascade', subtitle: 'Puzzle • Color match', category: 'Puzzle', icon: Layers3, palette: 'from-rose-400/30 via-violet-500/20 to-sky-500/30', tag: 'Popular', description: 'Sort a bright cascade of colors into matching groups.' },
  { id: 'memory-matrix', title: 'Memory Matrix', subtitle: 'Memory • Pattern recall', category: 'Memory', icon: Grid2X2, palette: 'from-blue-400/30 via-cyan-500/20 to-emerald-500/30', description: 'Repeat a growing pattern and train your recall.' },
  { id: 'quick-switch', title: 'Quick Switch', subtitle: 'Reflex • Reaction', category: 'Reflex', icon: Zap, palette: 'from-yellow-400/30 via-orange-500/20 to-pink-500/30', tag: 'New', description: 'React to changing signals in a quick-fire challenge.' },
  { id: 'shape-shifter', title: 'Shape Shifter', subtitle: 'Puzzle • Shapes', category: 'Puzzle', icon: Puzzle, palette: 'from-fuchsia-400/30 via-purple-500/20 to-indigo-500/30', description: 'Fit shifting shapes into a compact board.' },
  { id: 'star-hop', title: 'Star Hop', subtitle: 'Arcade • Precision', category: 'Arcade', icon: Star, palette: 'from-amber-300/30 via-pink-500/20 to-violet-600/30', tag: 'Popular', description: 'Navigate a field of stars with careful timing.' },
  { id: 'pattern-pop', title: 'Pattern Pop', subtitle: 'Memory • Sequences', category: 'Memory', icon: CircleDot, palette: 'from-cyan-300/30 via-blue-500/20 to-violet-500/30', description: 'Watch a sequence, then repeat it from memory.' },
  { id: 'flux-flow', title: 'Flux Flow', subtitle: 'Strategy • Routing', category: 'Strategy', icon: Orbit, palette: 'from-teal-300/30 via-emerald-500/20 to-blue-500/30', description: 'Connect the path while keeping your moves organized.' },
  { id: 'pixel-pilot', title: 'Pixel Pilot', subtitle: 'Arcade • Navigation', category: 'Arcade', icon: Gamepad2, palette: 'from-indigo-400/30 via-sky-500/20 to-fuchsia-500/30', tag: 'New', description: 'Guide a pixel craft through a friendly obstacle course.' },
  { id: 'tempo-tap', title: 'Tempo Tap', subtitle: 'Reflex • Rhythm', category: 'Reflex', icon: AudioLines, palette: 'from-orange-300/30 via-red-500/20 to-violet-500/30', description: 'Tap along with a changing rhythm and find your tempo.' },
  { id: 'gem-garden', title: 'Gem Garden', subtitle: 'Puzzle • Matching', category: 'Puzzle', icon: Sparkles, palette: 'from-emerald-300/30 via-cyan-500/20 to-blue-500/30', description: 'Arrange colorful gems into tidy matching patterns.' },
  { id: 'zen-tiles', title: 'Zen Tiles', subtitle: 'Memory • Focus', category: 'Memory', icon: Grid2X2, palette: 'from-lime-300/30 via-teal-500/20 to-cyan-500/30', description: 'A calm tile challenge built around focus and recall.' },
  { id: 'comet-course', title: 'Comet Course', subtitle: 'Arcade • Timing', category: 'Arcade', icon: Zap, palette: 'from-sky-300/30 via-indigo-500/20 to-purple-600/30', description: 'Find a smooth route through a field of drifting comets.' },
  { id: 'logic-lab', title: 'Logic Lab', subtitle: 'Strategy • Deduction', category: 'Strategy', icon: CircleDot, palette: 'from-violet-300/30 via-blue-500/20 to-teal-500/30', description: 'Solve small deduction puzzles one clue at a time.' },
  { id: 'blink-bounce', title: 'Blink Bounce', subtitle: 'Reflex • Timing', category: 'Reflex', icon: Zap, palette: 'from-pink-300/30 via-amber-500/20 to-orange-500/30', tag: 'New', description: 'Keep up with a bouncing marker in this reaction demo.' },
  { id: 'prism-path', title: 'Prism Path', subtitle: 'Puzzle • Routing', category: 'Puzzle', icon: Orbit, palette: 'from-pink-300/30 via-indigo-500/20 to-cyan-500/30', description: 'Rotate colorful pieces to create a continuous path.' },
  { id: 'memory-lane', title: 'Memory Lane', subtitle: 'Memory • Recall', category: 'Memory', icon: Layers3, palette: 'from-amber-300/30 via-rose-500/20 to-fuchsia-500/30', description: 'Recall the order of symbols as the challenge grows.' },
  { id: 'vector-vault', title: 'Vector Vault', subtitle: 'Strategy • Planning', category: 'Strategy', icon: Layers3, palette: 'from-slate-300/30 via-cyan-500/20 to-blue-500/30', description: 'Plan routes and solve spatial mini-puzzles.' },
  { id: 'lightning-lane', title: 'Lightning Lane', subtitle: 'Reflex • Reaction', category: 'Reflex', icon: Zap, palette: 'from-yellow-300/30 via-red-500/20 to-fuchsia-500/30', description: 'Choose the right response as signals flash across the screen.' },
  { id: 'moon-maze', title: 'Moon Maze', subtitle: 'Arcade • Exploration', category: 'Arcade', icon: Orbit, palette: 'from-indigo-300/30 via-purple-500/20 to-slate-600/30', description: 'Explore a compact moonlit maze in a casual navigation demo.' },
  { id: 'symbol-sprint', title: 'Symbol Sprint', subtitle: 'Memory • Recognition', category: 'Memory', icon: Star, palette: 'from-cyan-300/30 via-violet-500/20 to-pink-500/30', description: 'Spot familiar symbols in a quick visual memory round.' },
  { id: 'circuit-crafter', title: 'Circuit Crafter', subtitle: 'Strategy • Connections', category: 'Strategy', icon: Layers3, palette: 'from-emerald-300/30 via-blue-500/20 to-indigo-500/30', description: 'Connect circuit pieces to complete a simple logic board.' },
];

const categories: Category[] = ['All games', 'Arcade', 'Puzzle', 'Strategy', 'Memory', 'Reflex'];

const CasinoPage = () => {
  const [category, setCategory] = useState<Category>('All games');
  const [search, setSearch] = useState('');
  const [activeGame, setActiveGame] = useState<ArcadeGame | null>(null);
  const [target, setTarget] = useState(2);
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState(0);

  const visibleGames = useMemo(() => {
    const query = search.trim().toLowerCase();
    return games.filter((game) => {
      const matchesCategory = category === 'All games' || game.category === category;
      const matchesSearch = !query || `${game.title} ${game.subtitle} ${game.description}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [category, search]);

  const openGame = (game: ArcadeGame) => {
    setActiveGame(game);
    setScore(0);
    setRounds(0);
    setTarget(Math.floor(Math.random() * 4));
  };

  const tapTile = (index: number) => {
    if (index === target) {
      setScore((current) => current + 10);
      setRounds((current) => current + 1);
      setTarget((current) => {
        const next = Math.floor(Math.random() * 4);
        return next === current ? (next + 1) % 4 : next;
      });
    } else {
      setRounds((current) => current + 1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="container flex-1 py-6 md:py-10">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/" aria-label="Back to home">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Gamepad2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Arcade Lounge</h1>
              <p className="text-sm text-muted-foreground">Quick games. Big-brain moments. Just for fun.</p>
            </div>
          </div>
        </div>

        <section className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white md:p-10">
          <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative grid items-center gap-8 md:grid-cols-[1.3fr_0.7fr]">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" /> THE LINKABET ARCADE
              </div>
              <h2 className="text-3xl font-black leading-tight tracking-tight md:text-5xl">
                Find your next <span className="text-cyan-300">favorite game.</span>
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 md:text-base">
                Browse a growing library of original arcade, puzzle, memory, reflex, and strategy experiences. Discover featured picks and try self-contained demos.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => openGame(games[0])} className="rounded-xl bg-cyan-300 font-bold text-slate-950 hover:bg-cyan-200">
                  <Zap className="mr-2 h-4 w-4" /> Play featured demo
                </Button>
                <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200">
                  <Trophy className="h-4 w-4 text-amber-300" /> Personal bests
                </div>
              </div>
            </div>
            <div className="relative mx-auto flex aspect-square w-full max-w-[260px] items-center justify-center">
              <div className="absolute inset-5 rotate-12 rounded-[2rem] border border-cyan-300/30 bg-cyan-300/5" />
              <div className="absolute inset-9 -rotate-6 rounded-[2rem] border border-fuchsia-300/30 bg-fuchsia-300/5" />
              <div className="relative grid grid-cols-2 gap-3">
                {['bg-cyan-300', 'bg-fuchsia-400', 'bg-indigo-400', 'bg-amber-300'].map((color, index) => (
                  <div key={color} className={`flex h-20 w-20 items-center justify-center rounded-2xl shadow-2xl shadow-black/30 ${color} ${index === 1 ? 'rotate-6' : index === 2 ? '-rotate-6' : ''}`}>
                    <Star className="h-8 w-8 text-slate-950" fill="currentColor" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold">Explore the catalogue</h2>
            <p className="mt-1 text-sm text-muted-foreground">{visibleGames.length} games to discover · Original Linkabet demo catalogue</p>
          </div>
          <label className="flex h-11 w-full items-center gap-2 rounded-xl border bg-card px-3 lg:max-w-xs">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search games..."
              aria-label="Search games"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Game categories">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={category === item}
              onClick={() => setCategory(item)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${category === item ? 'bg-primary text-primary-foreground' : 'border bg-card text-muted-foreground hover:text-foreground'}`}
            >
              {item}
            </button>
          ))}
        </div>

        {visibleGames.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleGames.map((game) => {
              const Icon = game.icon;
              return (
                <article key={game.id} className="group overflow-hidden rounded-2xl border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                  <div className={`relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br ${game.palette}`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.14),transparent_58%)]" />
                    <div className="absolute -left-8 -top-10 h-36 w-36 rounded-full border border-white/20" />
                    <div className="absolute -bottom-16 -right-4 h-44 w-44 rounded-full border border-white/20" />
                    {game.tag && <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/25 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">{game.tag}</span>}
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/25 bg-black/20 text-white shadow-xl backdrop-blur-sm transition-transform group-hover:scale-110">
                      <Icon className="h-10 w-10" strokeWidth={1.6} />
                    </div>
                    <span className="absolute bottom-3 right-3 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white/90">{game.category}</span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold">{game.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{game.subtitle}</p>
                    <p className="mt-3 min-h-10 text-sm leading-5 text-muted-foreground">{game.description}</p>
                    <Button onClick={() => openGame(game)} className="mt-4 w-full rounded-xl" variant="secondary">
                      <Gamepad2 className="mr-2 h-4 w-4" /> Play demo
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-semibold">No games found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try another search or category.</p>
            <Button className="mt-4" variant="outline" onClick={() => { setSearch(''); setCategory('All games'); }}>Clear filters</Button>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 font-semibold text-foreground"><AudioLines className="h-4 w-4 text-primary" /> Built for casual play</div>
          <p>These are self-contained demo experiences. Scores are for fun only—there are no deposits, wagers, cash prizes, or cash-out features.</p>
        </div>
      </main>

      {activeGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="demo-title">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border bg-card shadow-2xl">
            <div className="flex items-start justify-between border-b p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Playable demo</p>
                <h2 id="demo-title" className="mt-1 text-xl font-bold">{activeGame.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Tap the glowing tile to earn score points.</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setActiveGame(null)} aria-label="Close game">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-5">
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Demo score</p><p className="text-2xl font-black">{score}</p></div>
                <div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Attempts</p><p className="text-2xl font-black">{rounds}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((tile) => (
                  <button
                    key={tile}
                    type="button"
                    onClick={() => tapTile(tile)}
                    aria-label={`Tile ${tile + 1}${tile === target ? ', glowing target' : ''}`}
                    className={`flex aspect-square items-center justify-center rounded-2xl border transition-all active:scale-95 ${tile === target ? 'border-cyan-300 bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/30' : 'bg-muted hover:bg-muted/70'}`}
                  >
                    {tile === target ? <Sparkles className="h-8 w-8" /> : <span className="text-xl text-muted-foreground">+</span>}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">No purchases or stakes. Your score is only for this demo session.</p>
              <Button className="mt-4 w-full rounded-xl" variant="outline" onClick={() => { setScore(0); setRounds(0); setTarget(Math.floor(Math.random() * 4)); }}>Restart demo</Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default CasinoPage;
