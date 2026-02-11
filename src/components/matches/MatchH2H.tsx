import { Match } from '@/types';
import { useMemo } from 'react';
import { Trophy, Minus } from 'lucide-react';

interface MatchH2HProps {
  match: Match;
}

interface PastMatch {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  competition: string;
}

export function MatchH2H({ match }: MatchH2HProps) {
  const history = useMemo(() => generateH2H(match), [match.id]);

  const homeWins = history.filter(m => m.homeScore > m.awayScore).length;
  const draws = history.filter(m => m.homeScore === m.awayScore).length;
  const awayWins = history.filter(m => m.homeScore < m.awayScore).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-bold text-lg mb-4">Head to Head — Last {history.length} Meetings</h3>

        <div className="flex items-center justify-center gap-6 py-4">
          <div className="text-center">
            <p className="text-3xl font-black text-primary">{homeWins}</p>
            <p className="text-xs text-muted-foreground mt-1">{match.homeTeam.name} Wins</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-muted-foreground">{draws}</p>
            <p className="text-xs text-muted-foreground mt-1">Draws</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-accent">{awayWins}</p>
            <p className="text-xs text-muted-foreground mt-1">{match.awayTeam.name} Wins</p>
          </div>
        </div>

        {/* Visual bar */}
        <div className="flex h-3 rounded-full overflow-hidden mt-2">
          <div className="bg-primary transition-all" style={{ width: `${(homeWins / history.length) * 100}%` }} />
          <div className="bg-muted transition-all" style={{ width: `${(draws / history.length) * 100}%` }} />
          <div className="bg-accent transition-all" style={{ width: `${(awayWins / history.length) * 100}%` }} />
        </div>
      </div>

      {/* Match list */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h4 className="font-bold text-sm mb-4">Previous Encounters</h4>
        <div className="space-y-3">
          {history.map((m, i) => {
            const homeWon = m.homeScore > m.awayScore;
            const awayWon = m.homeScore < m.awayScore;

            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 text-sm">
                <span className="text-xs text-muted-foreground w-20 shrink-0">{m.date}</span>
                <div className="flex-1 flex items-center justify-end gap-2">
                  <span className={`font-medium ${homeWon ? 'text-primary' : ''}`}>{m.homeTeam}</span>
                </div>
                <div className="flex items-center gap-1 px-3 py-1 rounded bg-secondary font-bold text-xs">
                  <span className={homeWon ? 'text-primary' : ''}>{m.homeScore}</span>
                  <Minus className="h-3 w-3 text-muted-foreground" />
                  <span className={awayWon ? 'text-accent' : ''}>{m.awayScore}</span>
                </div>
                <div className="flex-1">
                  <span className={`font-medium ${awayWon ? 'text-accent' : ''}`}>{m.awayTeam}</span>
                </div>
                <span className="text-[10px] text-muted-foreground hidden md:block w-28 text-right">{m.competition}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function generateH2H(match: Match): PastMatch[] {
  const comps = [match.league, 'Cup', 'Friendly', 'Super Cup'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Sep', 'Oct', 'Nov', 'Dec'];

  return Array.from({ length: 8 }, (_, i) => ({
    date: `${months[Math.floor(Math.random() * months.length)]} ${2020 + Math.floor(i / 2)}`,
    homeTeam: i % 2 === 0 ? match.homeTeam.name : match.awayTeam.name,
    awayTeam: i % 2 === 0 ? match.awayTeam.name : match.homeTeam.name,
    homeScore: Math.floor(Math.random() * 4),
    awayScore: Math.floor(Math.random() * 4),
    competition: comps[Math.floor(Math.random() * comps.length)],
  }));
}
