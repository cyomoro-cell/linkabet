import { useParams, Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BetSlip } from '@/components/betting/BetSlip';
import { useRealtimeMatches } from '@/hooks/useRealtimeMatches';
import { useBetSlip } from '@/hooks/useBetSlip';
import { Match } from '@/types';
import { sportIcons } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Zap, Clock, Receipt, Loader2,
  TrendingUp, BarChart3, History, Target, Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { useState, useMemo } from 'react';
import { MatchMarkets } from '@/components/matches/MatchMarkets';
import { MatchStats } from '@/components/matches/MatchStats';
import { MatchH2H } from '@/components/matches/MatchH2H';
import { MatchTimeline } from '@/components/matches/MatchTimeline';

const MatchDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { matches, isLoading } = useRealtimeMatches();
  const { selections } = useBetSlip();
  const [betSlipOpen, setBetSlipOpen] = useState(false);

  const match = matches.find(m => m.id === id);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground text-lg">Match not found</p>
          <Link to="/"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Back to Home</Button></Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Match Hero */}
        <MatchHero match={match} />

        {/* Content */}
        <div className="container py-6">
          <div className="flex gap-6">
            {/* Main content */}
            <div className="flex-1 min-w-0">
              <Tabs defaultValue="markets" className="w-full">
                <TabsList className="w-full justify-start bg-secondary/50 mb-6 overflow-x-auto">
                  <TabsTrigger value="markets" className="gap-1.5">
                    <Target className="h-3.5 w-3.5" /> Markets
                  </TabsTrigger>
                  <TabsTrigger value="stats" className="gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" /> Statistics
                  </TabsTrigger>
                  <TabsTrigger value="h2h" className="gap-1.5">
                    <History className="h-3.5 w-3.5" /> Head to Head
                  </TabsTrigger>
                  {match.isLive && (
                    <TabsTrigger value="timeline" className="gap-1.5">
                      <Zap className="h-3.5 w-3.5" /> Live Timeline
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="markets">
                  <MatchMarkets match={match} />
                </TabsContent>
                <TabsContent value="stats">
                  <MatchStats match={match} />
                </TabsContent>
                <TabsContent value="h2h">
                  <MatchH2H match={match} />
                </TabsContent>
                {match.isLive && (
                  <TabsContent value="timeline">
                    <MatchTimeline match={match} />
                  </TabsContent>
                )}
              </Tabs>
            </div>

            {/* Desktop Bet Slip */}
            <div className="hidden lg:block w-80 shrink-0">
              <div className="sticky top-20">
                <BetSlip />
              </div>
            </div>
          </div>
        </div>
      </main>
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

function MatchHero({ match }: { match: Match }) {
  return (
    <section className="relative bg-gradient-to-b from-secondary/50 to-background border-b border-border">
      <div className="container py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to matches
        </Link>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{sportIcons[match.sport]}</span>
          <span className="text-sm text-muted-foreground font-medium">{match.league}</span>
          {match.isLive && (
            <Badge variant="destructive" className="ml-2 gap-1">
              <Zap className="h-3 w-3 fill-current" /> LIVE {match.minute}'
            </Badge>
          )}
        </div>

        {/* Scoreboard */}
        <div className="flex items-center justify-center gap-8 md:gap-16 py-6">
          <TeamDisplay name={match.homeTeam.name} score={match.homeTeam.score} isLive={match.isLive} />

          <div className="flex flex-col items-center gap-2">
            {match.isLive ? (
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-3xl font-black text-primary"
              >
                VS
              </motion.div>
            ) : (
              <div className="text-center">
                <p className="text-2xl font-black text-muted-foreground">VS</p>
                <div className="flex items-center gap-1.5 text-muted-foreground mt-1">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">{format(match.startTime, 'MMM d, HH:mm')}</span>
                </div>
              </div>
            )}
          </div>

          <TeamDisplay name={match.awayTeam.name} score={match.awayTeam.score} isLive={match.isLive} />
        </div>

        {/* Quick Odds */}
        <div className="flex justify-center gap-3 mt-2">
          <QuickOdd label="1" team={match.homeTeam.name} odds={match.odds.home} matchId={match.id} match={match} selection="home" isLive={match.isLive} />
          {match.odds.draw !== undefined && (
            <QuickOdd label="X" team="Draw" odds={match.odds.draw} matchId={match.id} match={match} selection="draw" isLive={match.isLive} />
          )}
          <QuickOdd label="2" team={match.awayTeam.name} odds={match.odds.away} matchId={match.id} match={match} selection="away" isLive={match.isLive} />
        </div>
      </div>
    </section>
  );
}

function TeamDisplay({ name, score, isLive }: { name: string; score?: number; isLive: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 min-w-[100px]">
      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-secondary flex items-center justify-center">
        <span className="text-2xl md:text-3xl font-black text-muted-foreground">
          {name.charAt(0)}
        </span>
      </div>
      <p className="font-bold text-sm md:text-base text-center max-w-[120px]">{name}</p>
      {isLive && score !== undefined && (
        <motion.p
          key={score}
          initial={{ scale: 1.3, color: 'hsl(142, 76%, 50%)' }}
          animate={{ scale: 1, color: 'inherit' }}
          className="text-4xl font-black text-primary"
        >
          {score}
        </motion.p>
      )}
    </div>
  );
}

function QuickOdd({
  label, team, odds, matchId, match, selection, isLive,
}: {
  label: string; team: string; odds: number; matchId: string; match: Match;
  selection: 'home' | 'draw' | 'away'; isLive: boolean;
}) {
  const { selections, addSelection } = useBetSlip();
  const isActive = selections.find(s => s.matchId === matchId)?.selection === selection;

  return (
    <Button
      variant={isActive ? 'oddsActive' : 'odds'}
      className="flex flex-col gap-1 h-auto py-3 px-6 min-w-[100px] relative"
      onClick={() => addSelection({ matchId, match, selection, odds })}
    >
      <span className="text-[10px] text-muted-foreground uppercase">{team}</span>
      <motion.span
        key={odds.toFixed(2)}
        initial={isLive ? { color: 'hsl(142, 76%, 50%)' } : {}}
        animate={{ color: 'inherit' }}
        transition={{ duration: 1.5 }}
        className="text-lg font-black"
      >
        {odds.toFixed(2)}
      </motion.span>
      {isLive && <span className="absolute top-1 right-1 flex h-1.5 w-1.5 rounded-full bg-live animate-pulse" />}
    </Button>
  );
}

export default MatchDetailPage;
