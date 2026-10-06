import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowRight, Play, ShieldCheck, Smartphone, Zap, Headphones, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

const particles = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  size: 2 + (i % 4),
  duration: 12 + (i % 7) * 3,
  delay: -(i * 1.7),
}));

const badges = [
  { icon: ShieldCheck, label: 'Licensed by RDB' },
  { icon: Smartphone, label: 'MTN MoMo' },
  { icon: Zap, label: 'Instant Pay' },
  { icon: Headphones, label: '24/7 Support' },
];

function BetSlipMockup() {
  return (
    <div className="animate-float w-72 rounded-2xl border border-primary/30 bg-card/80 p-5 shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.45)] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-bold">Bet Slip</span>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">ACCA x3</span>
      </div>
      {[
        ['APR vs Rayon Sports', 'APR to win', '2.10'],
        ['Arsenal vs Chelsea', 'Over 2.5', '1.85'],
        ['REG vs Patriots', 'REG -4.5', '1.92'],
      ].map(([m, p, o]) => (
        <div key={m} className="mb-2 flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
          <div>
            <p className="text-[11px] text-muted-foreground">{m}</p>
            <p className="text-xs font-semibold">{p}</p>
          </div>
          <span className="text-sm font-bold text-primary">{o}</span>
        </div>
      ))}
      <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs">
        <div className="flex justify-between text-muted-foreground"><span>Stake</span><span>10,000 RWF</span></div>
        <div className="flex justify-between font-bold"><span>Payout</span><span className="text-primary">74,630 RWF</span></div>
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground">
        <Check className="h-4 w-4" /> Place Bet
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative flex min-h-[640px] items-center overflow-hidden">
      <div className="absolute inset-0 bg-mesh" />
      <div className="pointer-events-none absolute inset-0">
        {particles.map((p, i) => (
          <span
            key={i}
            className="animate-particle absolute bottom-0 rounded-full bg-primary/70"
            style={{ left: p.left, width: p.size, height: p.size, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

      <div className="container relative z-10 grid items-center gap-12 py-20 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-primary">
            <span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-ping rounded-full bg-primary" /><span className="relative h-2 w-2 rounded-full bg-primary" /></span>
            <span className="text-sm font-semibold">Live betting available now</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mb-6 text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
            Bet Smarter.<br />
            <span className="text-gradient-emerald">Win Bigger.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="mb-8 max-w-lg text-lg text-muted-foreground md:text-xl">
            Industry-leading odds, instant mobile money payouts, and live action on every match.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="mb-10 flex flex-wrap gap-4">
            <Button variant="hero" size="xl" asChild>
              <Link to="/auth">Start Betting <ArrowRight className="h-5 w-5" /></Link>
            </Button>
            <Button size="xl" variant="ghost" asChild
              className="border border-foreground/15 bg-foreground/5 backdrop-blur-md hover:bg-foreground/10">
              <Link to="/live"><Play className="h-5 w-5" /> Watch Live</Link>
            </Button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            {badges.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/50 px-3 py-2 backdrop-blur">
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-xs font-medium">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
          className="hidden justify-center lg:flex">
          <BetSlipMockup />
        </motion.div>
      </div>
    </section>
  );
}
