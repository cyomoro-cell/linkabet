import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/sections/HeroSection';
import { FeaturedMatches } from '@/components/sections/FeaturedMatches';
import { LiveMatches } from '@/components/sections/LiveMatches';
import { PromotionsSection } from '@/components/sections/PromotionsSection';
import { BetSlip } from '@/components/betting/BetSlip';
import { mockPromotions } from '@/data/mockData';
import { useMatches } from '@/hooks/useMatches';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Receipt, Loader2 } from 'lucide-react';
import { useBetSlip } from '@/hooks/useBetSlip';

const Index = () => {
  const { selections } = useBetSlip();
  const [betSlipOpen, setBetSlipOpen] = useState(false);
  const { data: matches, isLoading, error } = useMatches();

  const displayMatches = matches || [];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        <HeroSection />
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading matches...</span>
          </div>
        ) : (
          <>
            <LiveMatches matches={displayMatches} />
            <FeaturedMatches matches={displayMatches} />
          </>
        )}
        <PromotionsSection promotions={mockPromotions} />
      </main>

      <Footer />

      {/* Desktop Bet Slip */}
      <div className="hidden lg:block fixed right-6 top-24 w-80 z-40">
        <BetSlip />
      </div>

      {/* Mobile Bet Slip */}
      <div className="lg:hidden">
        <Sheet open={betSlipOpen} onOpenChange={setBetSlipOpen}>
          <SheetTrigger asChild>
            <Button
              variant="hero"
              size="lg"
              className="fixed bottom-6 right-6 z-50 rounded-full shadow-xl"
            >
              <Receipt className="h-5 w-5" />
              {selections.length > 0 && (
                <span className="ml-1">{selections.length}</span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl p-0">
            <div className="p-6 overflow-y-auto h-full">
              <BetSlip />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default Index;
