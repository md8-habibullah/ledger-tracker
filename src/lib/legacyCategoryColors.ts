/*
 * The ONE place the old multi-colour category defaults still appear. Vaults created before the owner's 2026-11-12
 * palette decision store those hexes in their database; they are shown as the matching indigo or slate tone instead.
 * src/theme/palette.test.ts allowlists this file by name; every other source file must stay inside the palette.
 */

/**
 * The colours vaults were created with before the palette became indigo and slate, and the tone each shows as now.
 * Used for DISPLAY only: the stored value is never rewritten, and any colour the user typed themselves is left alone.
 */
const LEGACY_CATEGORY_COLORS: Record<string, string> = {
  "#1e8a4d": "#5C5FAD",
  "#60831b": "#6669B2",
  "#2b8b27": "#7173B7",
  "#a36f14": "#7B7DBC",
  "#c55911": "#7173B7",
  "#8b760e": "#6D7987",
  "#d34558": "#5C5FAD",
  "#d0437c": "#818E9C",
  "#dc3d38": "#6669B2",
  "#268764": "#768493",
  "#76801e": "#8587C1",
  "#ad6b1f": "#636F7E",
  "#d94520": "#7B7DBC",
  "#b36442": "#768493",
  "#2b883a": "#5C5FAD",
  "#837663": "#636F7E",
};

export function currentCategoryColor(hex: string): string {
  return LEGACY_CATEGORY_COLORS[hex.toLowerCase()] ?? hex;
}
