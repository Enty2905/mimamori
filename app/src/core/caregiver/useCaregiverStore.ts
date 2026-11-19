import { create } from 'zustand';

interface CaregiverState {
  selectedElderlyId: number | null;
  selectedElderlyName: string | null;
  setSelectedElderlyId: (id: number | null) => void;
  setSelectedElderlyName: (name: string | null) => void;
}

export const useCaregiverStore = create<CaregiverState>((set) => ({
  selectedElderlyId: null,
  selectedElderlyName: null,
  setSelectedElderlyId: (id) => set({ selectedElderlyId: id }),
  setSelectedElderlyName: (name) => set({ selectedElderlyName: name }),
}));
