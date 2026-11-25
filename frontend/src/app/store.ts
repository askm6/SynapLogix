/** Interface preferences kept between visits: theme, language and the last scenario and run used. */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
export type Language = 'es' | 'en';

interface UiState {
  theme: Theme;
  language: Language;
  scenarioId: string | null;
  runId: string | null;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  setScenarioId: (id: string | null) => void;
  setRunId: (id: string | null) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      language: 'es',
      scenarioId: null,
      runId: null,
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setLanguage: (language) => set({ language }),
      setScenarioId: (scenarioId) => set({ scenarioId }),
      setRunId: (runId) => set({ runId }),
    }),
    {
      name: 'synaplogix.ui',
      // localStorage can be missing (private windows): fall back to an in-memory store.
      storage: createJSONStorage(() => {
        try {
          localStorage.setItem('synaplogix.probe', '1');
          localStorage.removeItem('synaplogix.probe');
          return localStorage;
        } catch {
          const memory = new Map<string, string>();
          return {
            getItem: (k) => memory.get(k) ?? null,
            setItem: (k, v) => void memory.set(k, v),
            removeItem: (k) => void memory.delete(k),
          };
        }
      }),
    },
  ),
);
