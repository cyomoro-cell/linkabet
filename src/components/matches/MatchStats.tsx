import { Match } from '@/types';
import { Progress } from '@/components/ui/progress';
import { useMemo } from 'react';

interface MatchStatsProps {
  match: Match;
}

interface StatItem {
  label: string;
  home: number;
  away: number;
  format?: 'percent' | 'number';
}

export function MatchStats({ match }: MatchStatsProps) {
  const stats = useMemo(() => generateStats(match), [match.id]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-bold text-lg mb-6">Match Statistics</h3>

        <div className="space-y-5">
          {stats.map((stat) => {
            const total = stat.home + stat.away || 1;
            const homePercent = (stat.home / total) * 100;

            return (
              <div key={stat.label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-primary">
                    {stat.format === 'percent' ? `${stat.home}%` : stat.home}
                  </span>
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">{stat.label}</span>
                  <span className="font-medium text-accent">
                    {stat.format === 'percent' ? `${stat.away}%` : stat.away}
                  </span>
                </div>
                <div className="flex gap-1 h-2">
                  <div
                    className="bg-primary rounded-l-full transition-all duration-700"
                    style={{ width: `${homePercent}%` }}
                  />
                  <div
                    className="bg-accent rounded-r-full transition-all duration-700"
                    style={{ width: `${100 - homePercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamForm team={match.homeTeam.name} />
        <TeamForm team={match.awayTeam.name} />
      </div>
    </div>
  );
}

function TeamForm({ team }: { team: string }) {
  const form = useMemo(() => {
    const results = ['W', 'L', 'D', 'W', 'W'] as const;
    return Array.from({ length: 5 }, (_, i) => results[Math.floor(Math.random() * 3)]);
  }, [team]);

  const colorMap = { W: 'bg-success', L: 'bg-destructive', D: 'bg-warning' };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="font-bold text-sm mb-3">{team} — Recent Form</h4>
      <div className="flex gap-2">
        {form.map((r, i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${colorMap[r]} text-background`}
          >
            {r}
          </div>
        ))}
      </div>
    </div>
  );
}

function generateStats(match: Match): StatItem[] {
  const r = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min);

  return [
    { label: 'Possession', home: r(40, 65), away: 0, format: 'percent' as const },
    { label: 'Shots', home: r(5, 18), away: r(3, 15) },
    { label: 'Shots on Target', home: r(2, 8), away: r(1, 7) },
    { label: 'Corners', home: r(2, 10), away: r(1, 8) },
    { label: 'Fouls', home: r(5, 18), away: r(4, 16) },
    { label: 'Yellow Cards', home: r(0, 4), away: r(0, 4) },
    { label: 'Passes', home: r(300, 600), away: r(250, 550) },
    { label: 'Pass Accuracy', home: r(70, 92), away: r(68, 90), format: 'percent' as const },
  ].map(s => {
    if (s.label === 'Possession') {
      const away = 100 - s.home;
      return { ...s, away };
    }
    return s;
  });
}
