import { Sport } from '@/types';
import { sportIcons } from '@/data/mockData';
import { motion } from 'framer-motion';

interface SportFilterProps {
  sports: Sport[];
  activeSport: Sport | 'all';
  onSportChange: (sport: Sport | 'all') => void;
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

export function SportFilter({ sports, activeSport, onSportChange }: SportFilterProps) {
  const allSports: (Sport | 'all')[] = ['all', ...sports];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {allSports.map((sport) => {
        const isActive = activeSport === sport;
        return (
          <button
            key={sport}
            onClick={() => onSportChange(sport)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
              isActive
                ? 'text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeSport"
                className="absolute inset-0 bg-primary rounded-lg"
                transition={{ type: 'spring', duration: 0.4 }}
              />
            )}
            <span className="relative z-10">
              {sport !== 'all' && sportIcons[sport]}
            </span>
            <span className="relative z-10">{sportLabels[sport] || sport}</span>
          </button>
        );
      })}
    </div>
  );
}
