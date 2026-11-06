import { createContext, useContext, useState, type ReactNode } from "react";
export const DEFAULT_PREFERENCES = {
  currency: "₹",
  dateDisplay: "DD MMM YYYY",
  rowsPerPage: 10,
  modelSource: "Saved model",
  maxDiscount: 15,
  allowDiscounts: true,
};
const Context = createContext({
  preferences: DEFAULT_PREFERENCES,
  setPreferences: (_p: typeof DEFAULT_PREFERENCES) => {},
});
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  return <Context.Provider value={{ preferences, setPreferences }}>{children}</Context.Provider>;
}
export const usePreferences = () => useContext(Context);
export function useFormat() {
  const { preferences } = usePreferences();
  return {
    money: (n: number) => `${preferences.currency} ${n.toLocaleString("en-IN")}`,
    date: (d: string) =>
      preferences.dateDisplay === "YYYY-MM-DD"
        ? d
        : new Date(d).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          }),
  };
}
