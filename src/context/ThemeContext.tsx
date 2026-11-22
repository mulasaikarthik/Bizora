import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: (event?: React.MouseEvent) => void;
  isTransitioning: boolean;
  shatterOrigin: { x: number; y: number };
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = "bizora-color-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "dark" || stored === "light") return stored;
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    } catch {
      // Ignore localStorage access errors
    }
    return "light";
  });

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [shatterOrigin, setShatterOrigin] = useState({ x: 0.5, y: 0.5 });

  // Sync with DOM
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore
    }
  }, [theme]);

  const toggleTheme = (event?: React.MouseEvent) => {
    if (isTransitioning) return;

    if (event) {
      const x = event.clientX / window.innerWidth;
      const y = event.clientY / window.innerHeight;
      setShatterOrigin({ x, y });
    } else {
      setShatterOrigin({ x: 0.85, y: 0.05 });
    }

    setIsTransitioning(true);

    // Switch theme midway through fracture animation
    setTimeout(() => {
      setTheme((prev) => (prev === "light" ? "dark" : "light"));
    }, 280);

    // End transition after shards settle and dissolve
    setTimeout(() => {
      setIsTransitioning(false);
    }, 780);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isTransitioning, shatterOrigin }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
