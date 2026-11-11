import { Navigate, useLocation } from "react-router-dom";
import { useStartVault, useVault } from "@/vault/VaultProvider";
import { AppShell } from "./AppShell";
import { Splash } from "./Splash";

/** Layout route for everything under /app: nothing renders unless a vault is unlocked in memory. */
export function RequireVault() {
  useStartVault();
  const { phase, error, snapshot } = useVault();
  const location = useLocation();
  if (phase === "booting") return <Splash />;
  if (phase === "error") {
    return (
      <div className="mx-auto max-w-prose px-4 py-20" role="alert">
        <h1 className="text-2xl">Ledger Tracker could not start</h1>
        <p className="mt-2 text-muted-foreground">{error}</p>
        <p className="mt-2 text-muted-foreground">This usually means the browser blocks local storage (for example in a private window). Try a normal window.</p>
      </div>
    );
  }
  if (snapshot.status !== "unlocked") return <Navigate to="/unlock" replace state={{ from: location.pathname }} />;
  return <AppShell />;
}
