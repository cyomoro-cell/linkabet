import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Trophy, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

const tickerItems = [
  '⚽ APR 2-1 Rayon Sports 67\'',
  '🏀 REG 78-72 Patriots Q4',
  '🎾 Djokovic 6-4 3-2 Alcaraz',
  '⚽ Arsenal 1-1 Chelsea 54\'',
  '🏀 Lakers 101-98 Celtics Q4',
  '⚽ Police FC 0-0 Kiyovu 23\'',
];

export function LiveTicker() {
  const items = [...tickerItems, ...tickerItems];
  return (
    <div className="relative flex items-center overflow-hidden border-b border-border bg-card/80">
      <div className="z-10 flex shrink-0 items-center gap-2 bg-live px-3 py-2 text-xs font-bold text-live-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-live-foreground" /> LIVE RIGHT NOW
      </div>
      <div className="flex animate-marquee whitespace-nowrap">
        {items.map((t, i) => (
          <span key={i} className="px-6 py-2 text-xs font-medium text-muted-foreground">
            {t} <span className="ml-6 text-border">|</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const wins = [
  'Jean M. won 250,000 RWF on Arsenal vs Chelsea',
  'Aline U. won 1,200,000 RWF on a 6-fold accumulator',
  'Eric N. won 480,000 RWF on APR vs Rayon Sports',
  'Grace K. won 95,000 RWF on REG vs Patriots',
  'Patrick H. won 730,000 RWF on Real Madrid vs Barcelona',
];

export function BigWinsCarousel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % wins.length), 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="container py-6">
      <div className="flex items-center gap-4 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/10 to-transparent p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/20">
          <Trophy className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-accent">Recent big wins</p>
          <p key={i} className="animate-fade-in truncate font-semibold">{wins[i]}</p>
        </div>
        <div className="hidden gap-1 sm:flex">
          {wins.map((_, n) => (
            <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-accent' : 'w-1.5 bg-border'}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function MobileWalletBar() {
  const { isAuthenticated, wallet } = useAuth() as any;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-border bg-card/95 px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-primary" />
        <div>
          <p className="text-[10px] text-muted-foreground">Balance</p>
          <p className="text-sm font-bold">
            {isAuthenticated ? formatCurrency(Number(wallet?.balance ?? 0), wallet?.currency ?? 'USD') : 'Sign in'}
          </p>
        </div>
      </div>
      <Button size="sm" variant="hero" asChild className="mr-16">
        <Link to={isAuthenticated ? '/account' : '/auth'}>Deposit</Link>
      </Button>
    </div>
  );
}

export function LiveChatButton() {
  return (
    <button
      onClick={() => toast('Live chat is coming soon — our team is available 24/7.')}
      aria-label="Live chat"
      className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_25px_hsl(var(--primary)/0.5)] transition-transform hover:scale-110 lg:bottom-6"
    >
      <MessageCircle className="h-6 w-6" />
      <span className="absolute right-1 top-1 flex h-3 w-3">
        <span className="absolute h-full w-full animate-ping rounded-full bg-primary-foreground opacity-75" />
        <span className="relative h-3 w-3 rounded-full border-2 border-primary bg-primary-foreground" />
      </span>
    </button>
  );
}
