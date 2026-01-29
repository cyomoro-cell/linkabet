import { Promotion } from '@/types';
import { PromotionCard } from '@/components/promotions/PromotionCard';
import { Gift } from 'lucide-react';

interface PromotionsSectionProps {
  promotions: Promotion[];
}

export function PromotionsSection({ promotions }: PromotionsSectionProps) {
  return (
    <section className="py-12">
      <div className="container">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Gift className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Promotions</h2>
            <p className="text-sm text-muted-foreground">Exclusive offers for you</p>
          </div>
        </div>

        {/* Promotions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promotions.map((promotion, index) => (
            <PromotionCard key={promotion.id} promotion={promotion} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
