/**
 * Public-facing identity. Edit here; nothing else in the code base hard-codes it.
 *
 * `agency` is intentionally null until the owner decides how to credit the studio on the
 * public pages (docs/ai/ROADMAP.md decision D7). When set, the case study shows a
 * "Start a project" link and the footer shows the credit. Plain external link only — no tracker.
 */
export interface SiteConfig {
  name: string;
  repoUrl: string;
  agency: { name: string; url: string } | null;
}

export const SITE: SiteConfig = {
  name: "Ledger Tracker",
  repoUrl: "https://github.com/md8-habibullah/ledger-tracker",
  agency: null,
};
