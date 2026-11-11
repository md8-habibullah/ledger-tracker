import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PasswordField, UsernameHint } from "@/components/auth/PasswordField";
import { Glow } from "@/components/fx/Glow";
import { Seal } from "@/components/ledger/Seal";
import { Splash } from "@/components/layout/Splash";
import { InvalidBackupError, InvalidRecoveryKeyError, WrongCredentialsError, CorruptVaultError } from "@/crypto/envelope";
import { FutureSchemaError } from "@/db/schema";
import { VaultBusyError, VaultExistsError, WeakPasswordError } from "@/vault/service";
import { readLastVaultId, takeLockReason, useStartVault, useVault } from "@/vault/VaultProvider";

const OPEN_MS = 650;

function explain(error: unknown): string {
  if (error instanceof WrongCredentialsError) return "That password does not open this vault. Check it and try again.";
  if (error instanceof InvalidRecoveryKeyError) return "That recovery key looks mistyped. Check it against the one you saved.";
  if (error instanceof VaultBusyError || error instanceof FutureSchemaError || error instanceof WeakPasswordError || error instanceof InvalidBackupError) return error.message;
  if (error instanceof CorruptVaultError) return "This vault's data failed its integrity check. Restore it from a backup file.";
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function Unlock() {
  useStartVault();
  const { phase, service, snapshot, vaults, legacyUsers, refresh } = useVault();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const reason = useMemo(() => takeLockReason(), []);

  const [vaultId, setVaultId] = useState<string>("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [failures, setFailures] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  const [mode, setMode] = useState<"password" | "recovery">("password");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseText, setEraseText] = useState("");
  const [overwrite, setOverwrite] = useState<{ json: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fallback = vaults.find((v) => v.id === readLastVaultId())?.id ?? vaults[0]?.id ?? "";
    if (!vaultId && vaults.length > 0) setVaultId(fallback);
    if (vaultId && !vaults.some((v) => v.id === vaultId)) setVaultId(fallback);
  }, [vaults, vaultId]);

  // Another vault means another password: never carry the last attempt's text or error across.
  const chooseVault = (id: string) => {
    setVaultId(id);
    setPassword("");
    setRecoveryKey("");
    setError(undefined);
  };

  // Backoff countdown after repeated failures (cosmetic deterrent; the real defence is the key stretching).
  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [waitUntil]);
  const waitSeconds = Math.max(0, Math.ceil((waitUntil - now) / 1000));

  if (phase === "booting") return <Splash />;
  if (snapshot.status === "unlocked" && !snapshot.ephemeral && !opening && !busy) return <Navigate to={location.state?.from ?? "/app"} replace />;
  if (phase === "ready" && vaults.length === 0 && legacyUsers && !opening) return <Navigate to="/migrate" replace />;

  const finishOpening = () => {
    setOpening(true);
    window.setTimeout(() => navigate(location.state?.from ?? "/app", { replace: true }), OPEN_MS);
  };

  const onUnlock = async (e: FormEvent) => {
    e.preventDefault();
    if (!service || !vaultId || busy || waitSeconds > 0) return;
    setBusy(true);
    setError(undefined);
    try {
      await service.unlock(vaultId, password);
      setPassword("");
      finishOpening();
    } catch (err) {
      setError(explain(err));
      if (err instanceof WrongCredentialsError) {
        const n = failures + 1;
        setFailures(n);
        if (n >= 3) { const wait = Math.min(30, 2 ** (n - 2)) * 1000; setWaitUntil(Date.now() + wait); setNow(Date.now()); }
      }
    } finally {
      setBusy(false);
    }
  };

  const onRecover = async (e: FormEvent) => {
    e.preventDefault();
    if (!service || !vaultId || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await service.unlockWithRecovery(vaultId, recoveryKey, newPassword);
      toast.success("New password set. Your recovery key still works.");
      finishOpening();
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !service) return;
    try {
      const json = await file.text();
      const meta = await service.importBackup(json);
      await refresh();
      setVaultId(meta.id);
      toast.success(`Restored “${meta.name}”. Unlock it with its password.`);
    } catch (err) {
      if (err instanceof VaultExistsError) setOverwrite({ json: await file.text(), name: err.existing.name });
      else toast.error(explain(err));
    }
  };

  const confirmOverwrite = async () => {
    if (!overwrite || !service) return;
    try {
      await service.importBackup(overwrite.json, { overwrite: true });
      await refresh();
      toast.success(`“${overwrite.name}” was replaced with the backup.`);
    } catch (err) {
      toast.error(explain(err));
    }
    setOverwrite(null);
  };

  const erase = async () => {
    if (!service) return;
    await service.eraseAll();
    await refresh();
    setEraseOpen(false);
    setEraseText("");
    toast.success("Everything was erased from this device.");
  };

  const hasVaults = vaults.length > 0;
  return (
    <div className="glass relative mx-auto my-8 grid w-[min(28rem,calc(100%-2rem))] gap-7 overflow-hidden p-7 md:my-14 md:p-9">
      <div className="relative flex flex-col items-center gap-5 text-center">
        <div className="relative grid h-32 w-32 place-items-center">
          <Glow className="inset-0 opacity-80" />
          <span aria-hidden className="absolute inset-4 animate-pulse-ring rounded-full border border-foil-2/60" />
          <span aria-hidden className="absolute inset-4 animate-pulse-ring rounded-full border border-foil-4/50 [animation-delay:-1.4s]" />
          <Seal state={opening ? "open" : "sealed"} size={56} glow animate={!opening} title={opening ? "Unlocked" : "Locked"} />
        </div>
        <div>
          <h1 className="text-[1.75rem] leading-9">{hasVaults ? (mode === "recovery" ? "Use your recovery key" : "Unlock your vault") : "No vault on this device"}</h1>
          <p className="mt-1 text-muted-foreground" role="status">
            {reason === "idle" ? "Locked after a period of inactivity." : reason === "manual" ? "Locked. Your data is encrypted." : hasVaults ? "Your data is encrypted on this device." : "Create one to start tracking, or restore a backup."}
          </p>
        </div>
      </div>

      {hasVaults ? (
        <form onSubmit={mode === "password" ? onUnlock : onRecover} className="grid gap-4" noValidate>
          <UsernameHint name={vaults.find((v) => v.id === vaultId)?.name ?? ""} />
          {vaults.length > 1 ? (
            <div className="grid gap-1.5">
              <Label htmlFor="vault-select">Vault</Label>
              <Select name="vault" value={vaultId} onValueChange={chooseVault}>
                <SelectTrigger id="vault-select"><SelectValue /></SelectTrigger>
                <SelectContent>{vaults.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Vault: <span className="font-medium text-foreground">{vaults[0].name}</span></p>
          )}

          {mode === "password" ? (
            <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" error={error} autoFocus />
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="recovery-key">Recovery key</Label>
                <Input id="recovery-key" value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value)} autoComplete="off" spellCheck={false} autoFocus className="figure h-11" placeholder="XXXX-XXXX-XXXX-…" aria-invalid={!!error} translate="no" />
              </div>
              <PasswordField label="Choose a new password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" error={error} meter />
            </>
          )}

          <Button type="submit" size="lg" disabled={busy || opening || waitSeconds > 0 || (mode === "password" ? !password : !recoveryKey || !newPassword)}>
            {opening ? "Unlocked" : busy ? "Unlocking…" : waitSeconds > 0 ? `Try again in ${waitSeconds}s` : mode === "password" ? "Unlock" : "Set new password and unlock"}
          </Button>

          <button type="button" className="justify-self-start text-sm text-primary underline underline-offset-2" onClick={() => { setMode(mode === "password" ? "recovery" : "password"); setError(undefined); }}>
            {mode === "password" ? "Forgot your password? Use the recovery key" : "Back to password"}
          </button>
        </form>
      ) : (
        <div className="grid gap-3">
          <Button asChild size="lg"><Link to="/create">Create a vault</Link></Button>
          <Button variant="outline" size="lg" onClick={() => fileRef.current?.click()}>Restore from a backup file</Button>
          <Button asChild variant="ghost"><Link to="/demo">Look around the demo first</Link></Button>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />

      <div className="grid gap-2 border-t border-foreground/10 pt-5 text-sm">
        {hasVaults ? (
          <>
            <p><Link className="text-primary underline underline-offset-2" to="/create">Create another vault</Link></p>
            <p><button className="text-primary underline underline-offset-2" onClick={() => fileRef.current?.click()}>Restore from a backup file</button></p>
            {legacyUsers ? <p>Data from an earlier version was found. <Link className="text-primary underline underline-offset-2" to="/migrate">Encrypt it now</Link></p> : null}
            <p><button className="text-muted-foreground underline underline-offset-2 hover:text-destructive" onClick={() => setEraseOpen(true)}>Can't get in? Erase everything on this device</button></p>
          </>
        ) : null}
      </div>

      <AlertDialog open={eraseOpen} onOpenChange={setEraseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erase everything on this device?</AlertDialogTitle>
            <AlertDialogDescription>
              All vaults stored in this browser are deleted, including any old unencrypted data. Backup files you saved are not touched and can still be restored. There is no undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="erase-all">Type ERASE to confirm</Label>
            <Input id="erase-all" value={eraseText} onChange={(e) => setEraseText(e.target.value)} autoComplete="off" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my data</AlertDialogCancel>
            <Button variant="destructive" disabled={eraseText !== "ERASE"} onClick={() => void erase()}>Erase everything</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!overwrite} onOpenChange={(open) => !open && setOverwrite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace “{overwrite?.name}” with this backup?</AlertDialogTitle>
            <AlertDialogDescription>A vault with the same identity is already on this device. Replacing it discards anything saved since the backup was made.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep what I have</AlertDialogCancel>
            <Button variant="destructive" onClick={() => void confirmOverwrite()}>Replace with backup</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
