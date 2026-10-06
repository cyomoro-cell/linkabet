import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface OddsButtonProps {
  label: string;
  odds: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function OddsButton({ label, odds, selected, disabled, onClick }: OddsButtonProps) {
  const prev = useRef(odds);
  const [trend, setTrend] = useState<'up' | 'down' | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    if (odds !== prev.current) {
      setTrend(odds > prev.current ? 'up' : 'down');
      setFlashKey((k) => k + 1);
      prev.current = odds;
    }
  }, [odds]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative flex h-12 min-w-[4.25rem] flex-col items-center justify-center overflow-hidden rounded-lg border text-sm transition-all duration-200',
        selected
          ? 'scale-[1.04] border-primary bg-primary text-primary-foreground shadow-[0_0_16px_hsl(var(--primary)/0.45)]'
          : 'border-border bg-secondary/70 hover:bg-secondary hover:border-primary/40',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {flashKey > 0 && !selected && (
        <span key={flashKey} className={cn('absolute inset-0', trend === 'up' ? 'flash-up' : 'flash-down')} />
      )}
      <span className={cn('relative text-[10px] font-medium', selected ? 'opacity-80' : 'text-muted-foreground')}>{label}</span>
      <span className="relative flex items-center gap-0.5 font-bold tabular-nums">
        {odds.toFixed(2)}
        {trend && (
          <span className={cn('text-[10px]', selected ? '' : trend === 'up' ? 'text-primary' : 'text-live')}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </span>
    </button>
  );
}
