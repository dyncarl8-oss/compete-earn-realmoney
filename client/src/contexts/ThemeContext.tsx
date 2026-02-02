import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme] = useState<Theme>("dark");

  useEffect(() => {
    // Force dark mode by adding dark class to html and body
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark");
    document.documentElement.style.backgroundColor = "hsl(220, 15%, 8%)";
    document.body.style.backgroundColor = "hsl(220, 15%, 8%)";
  }, []);

  const toggleTheme = () => {
    // Dark mode only - no toggle
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: () => {}, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}