import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MatchCard } from '@/components/matches/MatchCard';
import { DesktopSportSidebar, MobileSportSidebar } from '@/components/layout/SportSidebar';
import { BetSlip } from '@/components/betting/BetSlip';
import { useRealtimeMatches } from '@/hooks/useRealtimeMatches';
import { useBetSlip } from '@/hooks/useBetSlip';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Receipt, Loader2, Zap, Clock, TrendingUp, ArrowLeft } from 'lucide-react';
import { Sport } from '@/types';
import { Link } from 'react-router-dom';

type Category = 'live' | 'upcoming' | 'popular';

const categoryMeta: Record<Category, { label: string; icon: React.ReactNode; description: string }> = {
  live: { label: 'Live Matches', icon: <Zap className="h-6 w-6 text-live fill-current" />, description: 'All matches currently in play' },
  upcoming: { label: 'Upcoming Matches', icon: <Clock className="h-6 w-6 text-primary" />, description: 'Matches scheduled to start soon' },
  popular: { label: 'Popular Matches', icon: <TrendingUp className="h-6 w-6 text-primary" />, description: 'Most popular games with the best odds' },
};

export default function MatchesPage() {
  const [searchParams] = useSearchParams();
  const category = (searchParams.get('tab') as Category) || 'upcoming';
  const meta = categoryMeta[category] || categoryMeta.upcoming;

  const { selections } = useBetSlip();
  const [betSlipOpen, setBetSlipOpen] = useState(false);
  const [activeSport, setActiveSport] = useState<Sport | 'all'>('all');
  const [activeLeague, setActiveLeague] = useState<string>('all');
  const { matches, isLoading } = useRealtimeMatches();

  // Filter by sport & league
  const sportFiltered = matches.filter(m => {
    if (activeSport !== 'all' && m.sport !== activeSport) return false;
    if (activeLeague !== 'all' && m.league !== activeLeague) return false;
    return true;
  });

  // Filter by category
  const displayMatches =
    category === 'live' ? sportFiltered.filter(m => m.isLive) :
    category === 'upcoming' ? sportFiltered.filter(m => !m.isLive).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) :
    [...sportFiltered].sort((a, b) => (a.odds.home + (a.odds.draw ?? 0) + a.odds.away) - (b.odds.home + (b.odds.draw ?? 0) + b.odds.away));

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex">
        <DesktopSportSidebar
          matches={matches}
          activeSport={activeSport}
          activeLeague={activeLeague}
          onSportChange={setActiveSport}
          onLeagueChange={setActiveLeague}
        />

        <main className="flex-1 min-w-0">
          {/* Page Header */}
          <div className="border-b border-border bg-card/50">
            <div className="container py-6">
              <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  {meta.icon}
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{meta.label}</h1>
                  <p className="text-sm text-muted-foreground">{meta.description}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile filter */}
          <div className="lg:hidden container py-3">
            <MobileSportSidebar
              matches={matches}
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
            ) : displayMatches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayMatches.map(match => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg font-medium">
                  {category === 'live' ? 'No live matches right now' : 'No matches available'}
                </p>
                <p className="text-sm mt-1">Check back soon!</p>
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
}
