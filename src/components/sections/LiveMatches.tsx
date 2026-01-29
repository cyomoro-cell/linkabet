import { Match } from '@/types';
import { MatchCard } from '@/components/matches/MatchCard';
import { motion } from 'framer-motion';
import { Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LiveMatchesProps {
  matches: Match[];
}

export function LiveMatches({ matches }: LiveMatchesProps) {
  const liveMatches = matches.filter((m) => m.isLive);

  if (liveMatches.length === 0) return null;

  return (
    <section className="py-12 bg-gradient-to-b from-live/5 to-transparent">
      <div className="container">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-live/10">
              <Zap className="h-5 w-5 text-live fill-current" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-live" />
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">Live Now</h2>
              <p className="text-sm text-muted-foreground">
                {liveMatches.length} matches in progress
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            View All
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Live Match Grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {liveMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
