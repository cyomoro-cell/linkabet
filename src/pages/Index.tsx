import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/sections/HeroSection';
import { FeaturedMatches } from '@/components/sections/FeaturedMatches';
import { LiveMatches } from '@/components/sections/LiveMatches';
import { PromotionsSection } from '@/components/sections/PromotionsSection';
import { BetSlip } from '@/components/betting/BetSlip';
import { DesktopSportSidebar, MobileSportSidebar } from '@/components/layout/SportSidebar';
import { mockPromotions } from '@/data/mockData';
import { useRealtimeMatches } from '@/hooks/useRealtimeMatches';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Receipt, Loader2 } from 'lucide-react';
import { useBetSlip } from '@/hooks/useBetSlip';
import { Sport } from '@/types';

const Index = () => {
  const { selections } = useBetSlip();
  const [betSlipOpen, setBetSlipOpen] = useState(false);
  const [activeSport, setActiveSport] = useState<Sport | 'all'>('all');
  const [activeLeague, setActiveLeague] = useState<string>('all');
  const { matches, isLoading, liveCount } = useRealtimeMatches();

  // Filter matches by sport & league
  const filteredMatches = matches.filter(m => {
    if (activeSport !== 'all' && m.sport !== activeSport) return false;
    if (activeLeague !== 'all' && m.league !== activeLeague) return false;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <DesktopSportSidebar
          matches={matches}
          activeSport={activeSport}
          activeLeague={activeLeague}
          onSportChange={setActiveSport}
          onLeagueChange={setActiveLeague}
        />

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <HeroSection />

          {/* Mobile filter bar */}
          <div className="lg:hidden container py-3">
            <MobileSportSidebar
              matches={matches}
              activeSport={activeSport}
              activeLeague={activeLeague}
              onSportChange={setActiveSport}
              onLeagueChange={setActiveLeague}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading matches...</span>
            </div>
          ) : (
            <>
              <LiveMatches matches={filteredMatches} />
              <FeaturedMatches matches={filteredMatches} />
            </>
          )}
          <PromotionsSection promotions={mockPromotions} />
        </main>

        {/* Desktop Bet Slip */}
        <div className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-16 p-4">
            <BetSlip />
          </div>
        </div>
      </div>

      <Footer />

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
