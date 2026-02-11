import { useState } from 'react';
import { Match, Sport } from '@/types';
import { sportIcons } from '@/data/mockData';
import { ChevronDown, ChevronRight, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface SportSidebarProps {
  matches: Match[];
  activeSport: Sport | 'all';
  activeLeague: string | 'all';
  onSportChange: (sport: Sport | 'all') => void;
  onLeagueChange: (league: string) => void;
}

const sportLabels: Record<string, string> = {
  all: 'All Sports',
  football: 'Football',
  soccer: 'Soccer',
  basketball: 'Basketball',
  tennis: 'Tennis',
  cricket: 'Cricket',
  esports: 'Esports',
  mma: 'MMA',
  rugby: 'Rugby',
  'american football': 'American Football',
  'ice hockey': 'Ice Hockey',
};

function SidebarContent({ matches, activeSport, activeLeague, onSportChange, onLeagueChange }: SportSidebarProps) {
  const [expandedSports, setExpandedSports] = useState<Set<string>>(new Set([activeSport]));

  // Group matches by sport, then by league
  const sportGroups = matches.reduce<Record<string, { leagues: Record<string, number>; total: number; liveCount: number }>>((acc, match) => {
    if (!acc[match.sport]) {
      acc[match.sport] = { leagues: {}, total: 0, liveCount: 0 };
    }
    acc[match.sport].total++;
    acc[match.sport].leagues[match.league] = (acc[match.sport].leagues[match.league] || 0) + 1;
    if (match.isLive) acc[match.sport].liveCount++;
    return acc;
  }, {});

  const toggleExpand = (sport: string) => {
    setExpandedSports(prev => {
      const next = new Set(prev);
      if (next.has(sport)) next.delete(sport);
      else next.add(sport);
      return next;
    });
  };

  const totalLive = matches.filter(m => m.isLive).length;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Sports</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* All Sports */}
          <button
            onClick={() => { onSportChange('all'); onLeagueChange('all'); }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeSport === 'all' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <span>🏆 All Sports</span>
            <div className="flex items-center gap-2">
              {totalLive > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                  {totalLive} LIVE
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{matches.length}</span>
            </div>
          </button>

          {/* Sport Groups */}
          {Object.entries(sportGroups)
            .sort(([, a], [, b]) => b.liveCount - a.liveCount || b.total - a.total)
            .map(([sport, data]) => {
              const isExpanded = expandedSports.has(sport);
              const isActive = activeSport === sport;
              const leagues = Object.entries(data.leagues).sort(([, a], [, b]) => b - a);

              return (
                <div key={sport}>
                  <button
                    onClick={() => {
                      onSportChange(sport as Sport);
                      onLeagueChange('all');
                      toggleExpand(sport);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive && activeLeague === 'all' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{sportIcons[sport] || '🎯'}</span>
                      <span>{sportLabels[sport] || sport}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {data.liveCount > 0 && (
                        <span className="flex h-2 w-2 rounded-full bg-live animate-pulse" />
                      )}
                      <span className="text-xs text-muted-foreground">{data.total}</span>
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-4 pl-3 border-l border-border space-y-0.5 py-1">
                          {leagues.map(([league, count]) => (
                            <button
                              key={league}
                              onClick={() => {
                                onSportChange(sport as Sport);
                                onLeagueChange(league);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors ${
                                activeSport === sport && activeLeague === league
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                              }`}
                            >
                              <span className="truncate">{league}</span>
                              <span className="text-[10px] ml-2">{count}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
        </div>
      </ScrollArea>
    </div>
  );
}

// Desktop sidebar
export function DesktopSportSidebar(props: SportSidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border bg-sidebar h-[calc(100vh-4rem)] sticky top-16">
      <SidebarContent {...props} />
    </aside>
  );
}

// Mobile sidebar (sheet/drawer)
export function MobileSportSidebar(props: SportSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2"
      >
        <Filter className="h-4 w-4" />
        {props.activeSport !== 'all'
          ? `${sportIcons[props.activeSport] || ''} ${sportLabels[props.activeSport] || props.activeSport}`
          : 'All Sports'}
        {props.activeLeague !== 'all' && (
          <Badge variant="secondary" className="text-[10px]">{props.activeLeague}</Badge>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent
            {...props}
            onSportChange={(s) => { props.onSportChange(s); }}
            onLeagueChange={(l) => { props.onLeagueChange(l); setOpen(false); }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
