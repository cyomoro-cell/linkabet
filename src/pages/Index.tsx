import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/sections/HeroSection';
import { FeaturedMatches } from '@/components/sections/FeaturedMatches';
import { LiveMatches } from '@/components/sections/LiveMatches';
import { PromotionsSection } from '@/components/sections/PromotionsSection';
import { BetSlip } from '@/components/betting/BetSlip';
import { mockMatches, mockPromotions } from '@/data/mockData';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Receipt } from 'lucide-react';
import { useBetSlip } from '@/hooks/useBetSlip';

const Index = () => {
  const { selections } = useBetSlip();
  const [betSlipOpen, setBetSlipOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        <HeroSection />
        <LiveMatches matches={mockMatches} />
        <FeaturedMatches matches={mockMatches} />
        <PromotionsSection promotions={mockPromotions} />
      </main>

      <Footer />

      {/* Desktop Bet Slip - Fixed Sidebar */}
      <div className="hidden lg:block fixed right-6 top-24 w-80 z-40">
        <BetSlip />
      </div>

      {/* Mobile Bet Slip - Sheet */}
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
