import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField, UsernameHint } from "@/components/auth/PasswordField";
import { RecoveryKeyPanel } from "@/components/auth/RecoveryKeyPanel";
import { Splash } from "@/components/layout/Splash";
import type { LegacyUser } from "@/vault/legacy";
import { MigrationVerificationError, WeakPasswordError } from "@/vault/service";
import { useStartVault, useVault } from "@/vault/VaultProvider";

interface Done {
  recoveryKey: string;
  name: string;
  transactions: number;
  budgets: number;
  categoriesAdded: number;
  skipped: { reason: string; count: number }[];
}

function UserForm({ user, onDone }: { user: LegacyUser; onDone: (userId: number, result: Done) => void }) {
  const { service } = useVault();
  const [name, setName] = useState(user.username);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!service) return;
    if (password !== confirm) { setError("The two passwords do not match."); return; }
    setBusy(true);
    setError(undefined);
    try {
      const { meta, recoveryKey, report } = await service.migrateLegacyUser({ userId: user.id, name, password });
      onDone(user.id, { recoveryKey, name: meta.name, transactions: report.transactions, budgets: report.budgets, categoriesAdded: report.categoriesAdded, skipped: report.skipped });
    } catch (err) {
      setError(err instanceof WeakPasswordError || err instanceof MigrationVerificationError ? err.message : err instanceof Error ? err.message : "Could not encrypt this account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 pt-4" noValidate>
      <UsernameHint name={name.trim()} />
      <p className="text-sm text-muted-foreground">
        Choose a <strong className="font-semibold text-foreground">new</strong> password for this account. The old password is not reused, and it is not copied.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor={`name-${user.id}`}>Vault name</Label>
        <Input id={`name-${user.id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </div>
      <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" meter error={error} />
      <PasswordField label="Repeat new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      <div><Button type="submit" disabled={busy || !password || !confirm}>{busy ? "Encrypting and checking…" : "Encrypt this account"}</Button></div>
    </form>
  );
}

export default function Migrate() {
  useStartVault();
  const { phase, service, legacyUsers, vaults, refresh } = useVault();
  const navigate = useNavigate();
  const [open, setOpen] = useState<number | null>(null);
  const [done, setDone] = useState<Record<number, Done>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (phase === "booting") return <Splash />;
  if (!legacyUsers) return <Navigate to={vaults.length ? "/unlock" : "/create"} replace />;

  const finished = Object.keys(done).length;
  const latest = Object.values(done).at(-1);

  const deleteOld = async () => {
    if (!service) return;
    await service.deleteLegacy();
    await refresh();
    setConfirmDelete(false);
    toast.success("The old unencrypted copy was deleted.");
    navigate(finished > 0 ? "/app" : "/unlock", { replace: true });
  };

  return (
    <div className="glass mx-auto my-8 grid w-[min(42rem,calc(100%-2rem))] gap-8 p-7 md:my-12 md:p-9">
      <div>
        <h1 className="text-[1.75rem] leading-9">Encrypt your existing data</h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          An earlier version of Ledger Tracker stored your entries on this device <strong className="font-semibold text-foreground">without encryption</strong>, and kept passwords as plain text. Encrypting copies each account into its own protected vault. Nothing is deleted until you say so.
        </p>
      </div>

      <ul className="border-t border-foreground/10">
        {legacyUsers.map((u) => {
          const result = done[u.id];
          return (
            <li key={u.id} className="border-b border-foreground/10 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{u.username}</p>
                  <p className="text-sm text-muted-foreground">{u.transactionCount} entries · {u.budgetCount} budgets</p>
                </div>
                {result ? (
                  <span className="text-sm font-medium text-primary">Encrypted</span>
                ) : (
                  <Button variant={open === u.id ? "ghost" : "outline"} onClick={() => setOpen(open === u.id ? null : u.id)}>{open === u.id ? "Cancel" : "Encrypt this account"}</Button>
                )}
              </div>
              {open === u.id && !result ? <UserForm user={u} onDone={(id, r) => { setDone((d) => ({ ...d, [id]: r })); setOpen(null); void refresh(); }} /> : null}
              {result ? (
                <div className="grid gap-4 pt-4">
                  <p>
                    Copied {result.transactions} entries and {result.budgets} budgets into “{result.name}”, then opened the encrypted copy to check the totals match.
                    {result.categoriesAdded > 0 ? ` ${result.categoriesAdded} of your own categories were kept.` : ""}
                  </p>
                  {result.skipped.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Not copied: {result.skipped.map((s) => `${s.count} with ${s.reason}`).join(", ")}. These were invalid in the old data. They are still in the old copy until you delete it.
                    </p>
                  ) : null}
                  <p className="font-medium">Save the recovery key for this vault.</p>
                  <RecoveryKeyPanel recoveryKey={result.recoveryKey} vaultName={result.name} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="grid gap-3">
        {finished > 0 ? (
          <>
            <Button size="lg" onClick={() => navigate("/app", { replace: true })}>Open “{latest?.name}”</Button>
            <p className="text-sm text-muted-foreground">
              Once you have checked that your vaults open and look right, delete the old unencrypted copy. Until then it is still readable by anyone who can use this browser.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">The old unencrypted data stays readable on this device until you encrypt it and delete it.</p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>Delete the old unencrypted copy</Button>
          {finished === 0 ? <Button asChild variant="ghost"><Link to="/unlock">Not now</Link></Button> : null}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the old unencrypted copy?</AlertDialogTitle>
            <AlertDialogDescription>
              {finished < legacyUsers.length
                ? `Only ${finished} of ${legacyUsers.length} accounts have been encrypted. The rest will be lost for good.`
                : "All accounts have been encrypted."}{" "}
              Old plain-text passwords go with it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it for now</AlertDialogCancel>
            <Button variant="destructive" onClick={() => void deleteOld()}>Delete old copy</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
