import { useState } from 'react';
import { Match } from '@/types';
import { MatchCard } from '@/components/matches/MatchCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Clock, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type TabKey = 'live' | 'upcoming' | 'popular';

interface MatchTabsProps {
  matches: Match[];
}

export function MatchTabs({ matches }: MatchTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('live');

  const liveMatches = matches.filter(m => m.isLive);
  const upcomingMatches = matches.filter(m => !m.isLive).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  // Popular = highest combined odds (most betted feel)
  const popularMatches = [...matches].sort(
    (a, b) => (a.odds.home + (a.odds.draw ?? 0) + a.odds.away) - (b.odds.home + (b.odds.draw ?? 0) + b.odds.away)
  );

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      key: 'live',
      label: 'Live',
      icon: <Zap className="h-4 w-4" />,
      count: liveMatches.length,
    },
    {
      key: 'upcoming',
      label: 'Upcoming',
      icon: <Clock className="h-4 w-4" />,
      count: upcomingMatches.length,
    },
    {
      key: 'popular',
      label: 'Popular',
      icon: <TrendingUp className="h-4 w-4" />,
      count: popularMatches.length,
    },
  ];

  const displayMatches =
    activeTab === 'live' ? liveMatches :
    activeTab === 'upcoming' ? upcomingMatches :
    popularMatches;

  return (
    <section className="py-8">
      <div className="container">
        {/* Tab Bar */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/50 mb-6 w-fit">
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeMatchTab"
                    className={`absolute inset-0 rounded-lg ${
                      tab.key === 'live' ? 'bg-live' : 'bg-primary'
                    }`}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <Badge
                      variant={isActive && tab.key === 'live' ? 'outline' : 'secondary'}
                      className={`text-[10px] px-1.5 py-0 h-5 ${
                        isActive ? 'border-primary-foreground/30 text-primary-foreground' : ''
                      }`}
                    >
                      {tab.count}
                    </Badge>
                  )}
                  {tab.key === 'live' && liveMatches.length > 0 && !isActive && (
                    <span className="flex h-2 w-2 rounded-full bg-live animate-pulse" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Match Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {displayMatches.length > 0 ? (
              displayMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))
            ) : (
              <div className="col-span-full text-center py-16 text-muted-foreground">
                <p className="text-lg font-medium">
                  {activeTab === 'live' ? 'No live matches right now' : 'No matches available'}
                </p>
                <p className="text-sm mt-1">Check back soon!</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
