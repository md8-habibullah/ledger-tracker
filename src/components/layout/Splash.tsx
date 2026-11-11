import { LogoBadge } from "@/components/brand/LogoMark";

/** Full-screen placeholder shown while the vault engine or a page chunk is loading. */
export function Splash({ message = "Opening Ledger Tracker…" }: { message?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-3 bg-background text-muted-foreground" role="status">
      <LogoBadge size={44} className="animate-float" />
      <span>{message}</span>
    </div>
  );
}
