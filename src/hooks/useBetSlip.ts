import { BetSelection } from '@/types';
import { create } from 'zustand';

interface BetSlipState {
  selections: BetSelection[];
  stake: number;
  addSelection: (selection: BetSelection) => void;
  removeSelection: (matchId: string) => void;
  clearAll: () => void;
  setStake: (stake: number) => void;
  getTotalOdds: () => number;
  getPotentialWin: () => number;
}

export const useBetSlip = create<BetSlipState>((set, get) => ({
  selections: [],
  stake: 10,
  
  addSelection: (selection) => {
    set((state) => {
      const exists = state.selections.find((s) => s.matchId === selection.matchId);
      if (exists) {
        // Replace selection for same match
        return {
          selections: state.selections.map((s) =>
            s.matchId === selection.matchId ? selection : s
          ),
        };
      }
      return { selections: [...state.selections, selection] };
    });
  },
  
  removeSelection: (matchId) => {
    set((state) => ({
      selections: state.selections.filter((s) => s.matchId !== matchId),
    }));
  },
  
  clearAll: () => set({ selections: [], stake: 10 }),
  
  setStake: (stake) => set({ stake }),
  
  getTotalOdds: () => {
    const { selections } = get();
    if (selections.length === 0) return 0;
    return selections.reduce((acc, s) => acc * s.odds, 1);
  },
  
  getPotentialWin: () => {
    const { stake } = get();
    const totalOdds = get().getTotalOdds();
    return stake * totalOdds;
  },
}));
