import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MatchCard } from '@/components/matches/MatchCard';
import { DesktopSportSidebar, MobileSportSidebar } from '@/components/layout/SportSidebar';
import { BetSlip } from '@/components/betting/BetSlip';
import { useRealtimeMatches } from '@/hooks/useRealtimeMatches';
import { useBetSlip } from '@/hooks/useBetSlip';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Receipt, Loader2, Zap } from 'lucide-react';
import { Sport } from '@/types';

const LivePage = () => {
  const { selections } = useBetSlip();
  const [betSlipOpen, setBetSlipOpen] = useState(false);
  const [activeSport, setActiveSport] = useState<Sport | 'all'>('all');
  const [activeLeague, setActiveLeague] = useState<string>('all');
  const { matches, isLoading } = useRealtimeMatches();

  const liveMatches = matches.filter(m => m.isLive);

  const filtered = liveMatches.filter(m => {
    if (activeSport !== 'all' && m.sport !== activeSport) return false;
    if (activeLeague !== 'all' && m.league !== activeLeague) return false;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex">
        <DesktopSportSidebar
          matches={liveMatches}
          activeSport={activeSport}
          activeLeague={activeLeague}
          onSportChange={setActiveSport}
          onLeagueChange={setActiveLeague}
        />

        <main className="flex-1 min-w-0">
          {/* Page Header */}
          <div className="border-b border-border bg-card/50">
            <div className="container py-6">
              <div className="flex items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-live/10">
                  <Zap className="h-6 w-6 text-live fill-current" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-live" />
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Live Matches</h1>
                  <p className="text-sm text-muted-foreground">
                    {liveMatches.length} match{liveMatches.length !== 1 ? 'es' : ''} in play right now
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile filter */}
          <div className="lg:hidden container py-3">
            <MobileSportSidebar
              matches={liveMatches}
              activeSport={activeSport}
              activeLeague={activeLeague}
              onSportChange={setActiveSport}
              onLeagueChange={setActiveLeague}
            />
          </div>

          {/* Matches Grid */}
          <div className="container py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading matches...</span>
              </div>
            ) : filtered.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(match => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-lg font-medium">No live matches right now</p>
                <p className="text-sm mt-1">Check back soon for live action!</p>
              </div>
            )}
          </div>
        </main>

        <div className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-16 p-4"><BetSlip /></div>
        </div>
      </div>
      <Footer />

      {/* Mobile Bet Slip */}
      <div className="lg:hidden">
        <Sheet open={betSlipOpen} onOpenChange={setBetSlipOpen}>
          <SheetTrigger asChild>
            <Button variant="hero" size="lg" className="fixed bottom-6 right-6 z-50 rounded-full shadow-xl">
              <Receipt className="h-5 w-5" />
              {selections.length > 0 && <span className="ml-1">{selections.length}</span>}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl p-0">
            <div className="p-6 overflow-y-auto h-full"><BetSlip /></div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default LivePage;
