import { useState, useEffect, useCallback } from 'react';

export type ThemeId = 'dark' | 'light' | 'ocean' | 'forest' | 'sunset';

export interface Theme {
  id: ThemeId;
  name: string;
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
  };
}

export const themes: Theme[] = [
  {
    id: 'dark',
    name: 'Midnight Dark',
    colors: {
      background: '222 47% 6%',
      foreground: '210 40% 98%',
      card: '222 47% 8%',
      cardForeground: '210 40% 98%',
      popover: '222 47% 10%',
      popoverForeground: '210 40% 98%',
      primary: '187 85% 53%',
      primaryForeground: '222 47% 6%',
      secondary: '160 84% 39%',
      secondaryForeground: '222 47% 6%',
      muted: '222 30% 14%',
      mutedForeground: '215 20% 55%',
      accent: '160 84% 39%',
      accentForeground: '210 40% 98%',
      destructive: '0 72% 51%',
      destructiveForeground: '210 40% 98%',
      border: '222 30% 18%',
      input: '222 30% 14%',
      ring: '187 85% 53%',
    },
  },
  {
    id: 'light',
    name: 'Clean White',
    colors: {
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 98%',
      cardForeground: '222 47% 11%',
      popover: '0 0% 100%',
      popoverForeground: '222 47% 11%',
      primary: '187 85% 43%',
      primaryForeground: '0 0% 100%',
      secondary: '160 84% 35%',
      secondaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      accent: '210 40% 94%',
      accentForeground: '222 47% 11%',
      destructive: '0 72% 51%',
      destructiveForeground: '0 0% 100%',
      border: '214 32% 91%',
      input: '214 32% 91%',
      ring: '187 85% 43%',
    },
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    colors: {
      background: '220 50% 8%',
      foreground: '210 40% 98%',
      card: '220 50% 10%',
      cardForeground: '210 40% 98%',
      popover: '220 50% 12%',
      popoverForeground: '210 40% 98%',
      primary: '200 95% 55%',
      primaryForeground: '220 50% 8%',
      secondary: '175 70% 45%',
      secondaryForeground: '220 50% 8%',
      muted: '220 40% 15%',
      mutedForeground: '215 20% 55%',
      accent: '175 70% 45%',
      accentForeground: '210 40% 98%',
      destructive: '0 72% 51%',
      destructiveForeground: '210 40% 98%',
      border: '220 40% 20%',
      input: '220 40% 15%',
      ring: '200 95% 55%',
    },
  },
  {
    id: 'forest',
    name: 'Forest Green',
    colors: {
      background: '150 30% 6%',
      foreground: '150 20% 95%',
      card: '150 30% 9%',
      cardForeground: '150 20% 95%',
      popover: '150 30% 11%',
      popoverForeground: '150 20% 95%',
      primary: '142 76% 45%',
      primaryForeground: '150 30% 6%',
      secondary: '85 60% 45%',
      secondaryForeground: '150 30% 6%',
      muted: '150 20% 14%',
      mutedForeground: '150 15% 55%',
      accent: '85 60% 45%',
      accentForeground: '150 20% 95%',
      destructive: '0 72% 51%',
      destructiveForeground: '210 40% 98%',
      border: '150 20% 18%',
      input: '150 20% 14%',
      ring: '142 76% 45%',
    },
  },
  {
    id: 'sunset',
    name: 'Golden Sunset',
    colors: {
      background: '20 30% 6%',
      foreground: '30 30% 95%',
      card: '20 30% 9%',
      cardForeground: '30 30% 95%',
      popover: '20 30% 11%',
      popoverForeground: '30 30% 95%',
      primary: '35 95% 55%',
      primaryForeground: '20 30% 6%',
      secondary: '15 85% 55%',
      secondaryForeground: '20 30% 6%',
      muted: '20 20% 14%',
      mutedForeground: '20 15% 55%',
      accent: '15 85% 55%',
      accentForeground: '30 30% 95%',
      destructive: '0 72% 51%',
      destructiveForeground: '210 40% 98%',
      border: '20 20% 18%',
      input: '20 20% 14%',
      ring: '35 95% 55%',
    },
  },
];

const THEME_STORAGE_KEY = 'takatrack-theme';

export function useTheme() {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return (stored as ThemeId) || 'dark';
  });

  const applyTheme = useCallback((themeId: ThemeId) => {
    const theme = themes.find((t) => t.id === themeId);
    if (!theme) return;

    const root = document.documentElement;
    
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, value);
    });

    // Update sidebar colors based on theme
    root.style.setProperty('--sidebar-background', theme.colors.background);
    root.style.setProperty('--sidebar-foreground', theme.colors.foreground);
    root.style.setProperty('--sidebar-primary', theme.colors.primary);
    root.style.setProperty('--sidebar-primary-foreground', theme.colors.primaryForeground);
    root.style.setProperty('--sidebar-accent', theme.colors.muted);
    root.style.setProperty('--sidebar-accent-foreground', theme.colors.foreground);
    root.style.setProperty('--sidebar-border', theme.colors.border);
    root.style.setProperty('--sidebar-ring', theme.colors.ring);

    // Update glow effects
    root.style.setProperty('--glow-primary', `0 0 20px hsl(${theme.colors.primary} / 0.4)`);
    root.style.setProperty('--glow-secondary', `0 0 20px hsl(${theme.colors.secondary} / 0.4)`);
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${theme.colors.primary}), hsl(${theme.colors.secondary}))`);
    root.style.setProperty('--glass-bg', `hsl(${theme.colors.card} / 0.6)`);
    root.style.setProperty('--glass-border', `hsl(${theme.colors.border} / 0.3)`);
  }, []);

  const setTheme = useCallback((themeId: ThemeId) => {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    setCurrentTheme(themeId);
    applyTheme(themeId);
  }, [applyTheme]);

  useEffect(() => {
    applyTheme(currentTheme);
  }, []);

  return {
    currentTheme,
    setTheme,
    themes,
  };
}
