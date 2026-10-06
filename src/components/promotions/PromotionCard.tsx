import { Promotion } from '@/types';
import { motion } from 'framer-motion';
import { ArrowRight, Gift, Flame, Percent, Rocket, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

interface PromotionCardProps {
  promotion: Promotion & { endsAt?: string };
  index: number;
}

const icons = [Gift, Rocket, Percent];

function remaining(endsAt: string) {
  const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

export function PromotionCard({ promotion, index }: PromotionCardProps) {
  const Icon = icons[index % icons.length];
  const [, tick] = useState(0);
  useEffect(() => {
    if (!promotion.endsAt) return;
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [promotion.endsAt]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/60 p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/60 hover:shadow-[0_0_30px_-5px_hsl(var(--primary)/0.45)]"
    >
      {promotion.badge && (
        <div className="animate-glow-pulse absolute right-4 top-4 flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
          {promotion.badge === 'HOT' ? <Flame className="h-3 w-3" /> : <Gift className="h-3 w-3" />}
          {promotion.badge}
        </div>
      )}

      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30 transition-transform group-hover:scale-110">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h3 className="mb-1 text-xl font-bold">{promotion.title}</h3>
      <p className="mb-5 text-sm text-muted-foreground">{promotion.description}</p>

      <div className="flex items-center justify-between">
        <Link to="/auth" className="group/link inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          {promotion.ctaText}
          <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1.5" />
        </Link>
        {promotion.endsAt && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Ends in {remaining(promotion.endsAt)}
          </span>
        )}
      </div>
    </motion.div>
  );
}
