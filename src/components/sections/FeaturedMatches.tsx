import { Match, Sport } from '@/types';
import { MatchCard } from '@/components/matches/MatchCard';
import { SportFilter } from '@/components/filters/SportFilter';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

interface FeaturedMatchesProps {
  matches: Match[];
}

export function FeaturedMatches({ matches }: FeaturedMatchesProps) {
  const [activeSport, setActiveSport] = useState<Sport | 'all'>('all');

  const sports = [...new Set(matches.map((m) => m.sport))] as Sport[];
  const filteredMatches = activeSport === 'all' 
    ? matches 
    : matches.filter((m) => m.sport === activeSport);

  return (
    <section className="py-12">
      <div className="container">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Featured Matches</h2>
              <p className="text-sm text-muted-foreground">Popular games with the best odds</p>
            </div>
          </div>
          <SportFilter 
            sports={sports} 
            activeSport={activeSport} 
            onSportChange={setActiveSport} 
          />
        </div>

        {/* Match Grid */}
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
