import { create } from "zustand";

type UiState = {
  darkMode: boolean;
  selectedRange: "24h" | "7d" | "30d" | "12m";
  toggleDarkMode: () => void;
  setRange: (range: UiState["selectedRange"]) => void;
};

const initialDarkMode = localStorage.getItem("energyiq.theme") === "dark";

export const useUiStore = create<UiState>((set) => ({
  darkMode: initialDarkMode,
  selectedRange: "30d",
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.darkMode;
      localStorage.setItem("energyiq.theme", next ? "dark" : "light");
      return { darkMode: next };
    }),
  setRange: (selectedRange) => set({ selectedRange })
}));
