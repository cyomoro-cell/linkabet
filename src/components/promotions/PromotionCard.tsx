import { Promotion } from '@/types';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowRight, Gift, Percent, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PromotionCardProps {
  promotion: Promotion;
  index: number;
}

const badgeIcons: Record<string, React.ReactNode> = {
  NEW: <Gift className="h-3 w-3" />,
  HOT: <Star className="h-3 w-3 fill-current" />,
};

const gradients = [
  'from-primary/20 via-primary/5 to-transparent',
  'from-accent/20 via-accent/5 to-transparent',
  'from-blue-500/20 via-blue-500/5 to-transparent',
];

export function PromotionCard({ promotion, index }: PromotionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`relative overflow-hidden rounded-xl border border-border bg-gradient-to-br ${gradients[index % gradients.length]} p-6 card-hover`}
    >
      {/* Badge */}
      {promotion.badge && (
        <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 rounded-full bg-accent text-accent-foreground text-xs font-bold">
          {badgeIcons[promotion.badge]}
          {promotion.badge}
        </div>
      )}

      {/* Content */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Percent className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg mb-1">{promotion.title}</h3>
          <p className="text-sm text-muted-foreground mb-4">{promotion.description}</p>
          <Button variant="outline" size="sm">
            {promotion.ctaText}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
