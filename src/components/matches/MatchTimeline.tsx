import { Match } from '@/types';
import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, AlertTriangle, Flag, ArrowUpRight } from 'lucide-react';

interface MatchTimelineProps {
  match: Match;
}

interface TimelineEvent {
  minute: number;
  type: 'goal' | 'yellow' | 'red' | 'substitution' | 'var';
  team: 'home' | 'away';
  player: string;
  detail?: string;
}

export function MatchTimeline({ match }: MatchTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>(() => generateEvents(match));

  // Simulate new events arriving in realtime
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.85) {
        const types: TimelineEvent['type'][] = ['yellow', 'substitution', 'var'];
        const type = types[Math.floor(Math.random() * types.length)];
        const team: 'home' | 'away' = Math.random() > 0.5 ? 'home' : 'away';
        const minute = (match.minute || 45) + Math.floor(Math.random() * 5);
        const players = ['Johnson', 'Silva', 'Müller', 'Tanaka', 'Lee', 'Santos'];

        setEvents(prev => [
          ...prev,
          {
            minute,
            type,
            team,
            player: players[Math.floor(Math.random() * players.length)],
          },
        ].sort((a, b) => b.minute - a.minute));
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [match.minute]);

  const iconMap = {
    goal: <Zap className="h-4 w-4 text-primary fill-current" />,
    yellow: <div className="w-3 h-4 rounded-sm bg-warning" />,
    red: <div className="w-3 h-4 rounded-sm bg-destructive" />,
    substitution: <ArrowUpRight className="h-4 w-4 text-muted-foreground" />,
    var: <AlertTriangle className="h-4 w-4 text-accent" />,
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-6">
        <Zap className="h-5 w-5 text-live fill-current" />
        <h3 className="font-bold text-lg">Live Timeline</h3>
        <span className="flex h-2 w-2 rounded-full bg-live animate-pulse ml-2" />
      </div>

      <div className="relative">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2" />

        <div className="space-y-4">
          <AnimatePresence>
            {events.map((event, i) => (
              <motion.div
                key={`${event.minute}-${event.type}-${i}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 ${
                  event.team === 'home' ? 'flex-row' : 'flex-row-reverse'
                }`}
              >
                <div className={`flex-1 ${event.team === 'home' ? 'text-right' : 'text-left'}`}>
                  <p className="font-medium text-sm">{event.player}</p>
                  {event.detail && (
                    <p className="text-xs text-muted-foreground">{event.detail}</p>
                  )}
                </div>

                <div className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full bg-secondary border-2 border-border">
                  {iconMap[event.type]}
                </div>

                <div className="flex-1">
                  <span className="text-xs font-bold text-muted-foreground">{event.minute}'</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function generateEvents(match: Match): TimelineEvent[] {
  const maxMin = match.minute || 45;
  const players = {
    home: ['Johnson', 'Williams', 'García', 'Chen', 'Kim'],
    away: ['Silva', 'Müller', 'Tanaka', 'Santos', 'Lee'],
  };

  const events: TimelineEvent[] = [];
  const count = Math.floor(Math.random() * 5) + 3;

  for (let i = 0; i < count; i++) {
    const team = Math.random() > 0.5 ? 'home' : 'away';
    const types: TimelineEvent['type'][] = ['goal', 'yellow', 'substitution', 'var'];
    const weights = [0.25, 0.35, 0.3, 0.1];
    let r = Math.random();
    let type: TimelineEvent['type'] = 'yellow';
    for (let j = 0; j < weights.length; j++) {
      r -= weights[j];
      if (r <= 0) { type = types[j]; break; }
    }

    events.push({
      minute: Math.floor(Math.random() * maxMin) + 1,
      type,
      team,
      player: players[team][Math.floor(Math.random() * players[team].length)],
      detail: type === 'goal' ? 'Goal!' : type === 'var' ? 'VAR Review' : undefined,
    });
  }

  return events.sort((a, b) => b.minute - a.minute);
}
