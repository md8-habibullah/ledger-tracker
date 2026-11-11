import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Database, Download, FileDown, Lock, ShieldCheck } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasswordField, UsernameHint } from "@/components/auth/PasswordField";
import { RecoveryKeyPanel } from "@/components/auth/RecoveryKeyPanel";
import { PageHeader, RuleSection } from "@/components/ledger/bits";
import { Logo } from "@/components/brand/LogoMark";
import { setMeta } from "@/db/repo";
import { WrongCredentialsError } from "@/crypto/envelope";
import { downloadText, transactionsToCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/dates";
import { toHex } from "@/crypto/bytes";
import { CURRENCIES, currencyInfo } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useTheme, type Density, type ThemePreference } from "@/theme/ThemeProvider";
import { AUTO_LOCK_OPTIONS, useVault, type AutoLockMinutes } from "@/vault/VaultProvider";
import type { VaultInspection } from "@/vault/service";
import { useLedger, useMutate } from "@/vault/useLedger";

const TABS = [
  { id: "appearance", label: "Appearance" },
  { id: "security", label: "Security" },
  { id: "data", label: "Data" },
  { id: "about", label: "About" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-3 border-b border-border py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-8">
      <div>
        <h3 className="text-base">{title}</h3>
        {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Choice<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; hint?: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn("rounded-md border px-3 py-2.5 text-left transition-colors duration-fast", value === o.id ? "border-primary bg-band" : "border-input hover:bg-band")}
        >
          <span className="block font-medium">{o.label}</span>
          {o.hint ? <span className="block text-sm text-muted-foreground">{o.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Appearance */

function Appearance() {
  const { preference, setPreference, density, setDensity } = useTheme();
  const ledger = useLedger();
  const mutate = useMutate();
  const current = currencyInfo(ledger?.currency ?? "BDT");
  const compatible = CURRENCIES.filter((c) => c.digits === current.digits);
  return (
    <>
      <Row title="Theme" description="Pearl is the light theme, Vault the dark one. System follows your device.">
        <Choice<ThemePreference>
          label="Theme"
          value={preference}
          onChange={setPreference}
          options={[
            { id: "system", label: "System" },
            { id: "paper", label: "Pearl", hint: "Light" },
            { id: "vault", label: "Vault", hint: "Dark" },
          ]}
        />
      </Row>
      <Row title="Density" description="Compact fits more rows on screen.">
        <Choice<Density> label="Density" value={density} onChange={setDensity} options={[{ id: "comfortable", label: "Comfortable" }, { id: "compact", label: "Compact" }]} />
      </Row>
      <Row
        title="Currency"
        description={`Changes the symbol and grouping only; it does not convert amounts. Only currencies with ${current.digits} decimal places are offered, because amounts are stored in the smallest unit.`}
      >
        <Select
          value={current.code}
          onValueChange={(code) => void mutate((db) => setMeta(db, "currency", code), { success: `Currency set to ${code}` })}
        >
          <SelectTrigger aria-label="Currency"><SelectValue /></SelectTrigger>
          <SelectContent>
            {compatible.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} - {c.name} ({c.symbol})</SelectItem>)}
          </SelectContent>
        </Select>
      </Row>
    </>
  );
}

/* ------------------------------------------------------------------ Security */

function ChangePassword() {
  const { service, snapshot } = useVault();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!current) nextErrors.current = "Enter your current password.";
    if (next !== confirm) nextErrors.confirm = "The two new passwords do not match.";
    setErrors(nextErrors);
    if (nextErrors.current || nextErrors.confirm || !service) return;
    setBusy(true);
    try {
      await service.changePassword(current, next);
      toast.success("Password changed. Your recovery key still works.");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (error) {
      if (error instanceof WrongCredentialsError) setErrors({ current: "That is not your current password." });
      else setErrors({ next: error instanceof Error ? error.message : "Could not change the password." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid max-w-sm gap-4" noValidate>
      <UsernameHint name={snapshot.meta?.name ?? ""} />
      <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" error={errors.current} />
      <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" error={errors.next} meter />
      <PasswordField label="Repeat new password" value={confirm} onChange={setConfirm} autoComplete="new-password" error={errors.confirm} />
      <div><Button type="submit" disabled={busy}>Change password</Button></div>
    </form>
  );
}

function ReplaceRecoveryKey() {
  const { service } = useVault();
  const ledger = useLedger();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!service) return;
    setBusy(true);
    setError(undefined);
    try {
      setFresh(await service.rotateRecoveryKey(password));
      setPassword("");
    } catch (err) {
      setError(err instanceof WrongCredentialsError ? "That is not your current password." : err instanceof Error ? err.message : "Could not create a new key.");
    } finally {
      setBusy(false);
    }
  };

  if (fresh) {
    return (
      <div className="grid gap-4">
        <p className="font-medium">Your new recovery key. The old one no longer works.</p>
        <RecoveryKeyPanel recoveryKey={fresh} vaultName={ledger?.vaultName ?? "Vault"} />
        <div><Button variant="outline" onClick={() => setFresh(null)}>I have saved it</Button></div>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="grid max-w-sm gap-4" noValidate>
      <PasswordField label="Current password" value={password} onChange={setPassword} autoComplete="current-password" error={error} />
      <div><Button type="submit" variant="outline" disabled={busy || !password}>Create a new recovery key</Button></div>
    </form>
  );
}

function StoredView() {
  const { service, snapshot } = useVault();
  const [info, setInfo] = useState<VaultInspection | null>(null);
  useEffect(() => {
    if (!service || !snapshot.meta || snapshot.ephemeral) return;
    let live = true;
    void service.inspect(snapshot.meta.id).then((i) => live && setInfo(i)).catch(() => live && setInfo(null));
    return () => { live = false; };
  }, [service, snapshot.meta, snapshot.dataVersion, snapshot.ephemeral]);

  if (snapshot.ephemeral) return <p className="text-muted-foreground">The demo vault is never stored, so there is nothing on disk to inspect.</p>;
  if (!info) return <p className="text-muted-foreground">Reading what is stored…</p>;
  const sqliteHeader = "53 51 4C 69 74 65 20 66 6F 72 6D 61 74 20 33 00";
  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5">
        <dt className="text-muted-foreground">Encryption</dt><dd>{info.cipher}</dd>
        <dt className="text-muted-foreground">Password stretching</dt><dd>{info.kdf}</dd>
        <dt className="text-muted-foreground">Recovery key</dt><dd>{info.hasRecoveryKey ? "Set" : "Not set"}</dd>
        <dt className="text-muted-foreground">Stored size</dt><dd className="figure">{info.ciphertextBytes.toLocaleString("en-US")} bytes</dd>
        <dt className="text-muted-foreground">Saved</dt><dd className="figure whitespace-normal">{info.revision} {info.revision === 1 ? "time" : "times"}, last {formatDateTime(info.updatedAt)}</dd>
      </dl>
      <div className="grid gap-1.5 rounded-md border border-border bg-band p-3">
        <p className="text-sm text-muted-foreground">First 16 bytes stored on this device</p>
        <p className="figure whitespace-normal break-words text-sm" translate="no">{toHex(Uint8Array.from(info.firstBytes))}</p>
        <p className="mt-1 text-sm text-muted-foreground">A plain, unencrypted SQLite file would start with</p>
        <p className="figure whitespace-normal break-words text-sm text-muted-foreground" translate="no">{sqliteHeader}</p>
      </div>
    </div>
  );
}

function Security() {
  const { autoLockMinutes, setAutoLockMinutes, lock, snapshot } = useVault();
  const demo = snapshot.ephemeral;
  return (
    <>
      <Row title="Auto-lock" description="Locks the vault after this long without activity, and wipes it from this tab's memory.">
        <Select value={String(autoLockMinutes)} onValueChange={(v) => setAutoLockMinutes((v === "never" ? "never" : Number(v)) as AutoLockMinutes)} disabled={demo}>
          <SelectTrigger aria-label="Auto-lock"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AUTO_LOCK_OPTIONS.map((o) => <SelectItem key={String(o)} value={String(o)}>{o === "never" ? "Never (not recommended)" : o === 1 ? "After 1 minute" : `After ${o} minutes`}</SelectItem>)}
          </SelectContent>
        </Select>
      </Row>
      <Row title="Lock now" description="You will need your password to open the vault again.">
        <Button variant="outline" className="gap-2" onClick={() => void lock("manual")}><Lock className="h-4 w-4" aria-hidden />{demo ? "Exit demo" : "Lock now"}</Button>
      </Row>
      {demo ? null : (
        <>
          <Row title="Change password" description="Your data is not re-encrypted; only the key that protects it is replaced.">
            <ChangePassword />
          </Row>
          <Row title="Recovery key" description="If you forget your password, the recovery key is the only way back in. Creating a new one disables the old one.">
            <ReplaceRecoveryKey />
          </Row>
        </>
      )}
      <Row title="What is stored on this device" description="Read straight from storage without decrypting anything.">
        <StoredView />
      </Row>
    </>
  );
}

/* ------------------------------------------------------------------ Data */

function StorageStatus() {
  const [state, setState] = useState<{ persisted: boolean | null; usage: number | null }>({ persisted: null, usage: null });
  const refresh = async () => {
    try {
      const [persisted, estimate] = await Promise.all([navigator.storage?.persisted?.() ?? Promise.resolve(null), navigator.storage?.estimate?.() ?? Promise.resolve(null)]);
      setState({ persisted, usage: estimate?.usage ?? null });
    } catch { /* unsupported */ }
  };
  useEffect(() => { void refresh(); }, []);
  const ask = async () => {
    try {
      const granted = await navigator.storage.persist();
      toast[granted ? "success" : "message"](granted ? "The browser will keep this data." : "The browser declined. Keep a backup file as well.");
    } catch { toast.error("This browser does not support persistent storage."); }
    void refresh();
  };
  return (
    <div className="grid gap-3">
      <p>
        {state.persisted === null ? "Storage status is not available in this browser." : state.persisted ? "The browser has promised to keep this data." : "The browser may clear this data if the device runs low on space or you clear site data."}
        {state.usage !== null ? <> Using about <span className="figure">{(state.usage / 1024 / 1024).toFixed(1)} MB</span> in total.</> : null}
      </p>
      {state.persisted === false ? <div><Button variant="outline" onClick={() => void ask()}>Ask the browser to keep it</Button></div> : null}
    </div>
  );
}

function EraseVault() {
  const { service, snapshot, lock } = useVault();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const meta = snapshot.meta;
  if (!meta || snapshot.ephemeral) return null;

  const erase = async (e: FormEvent) => {
    e.preventDefault();
    if (!service) return;
    setBusy(true);
    setError(undefined);
    try {
      await service.deleteVault(meta.id, password);
      toast.success("Vault erased from this device");
      await lock("manual");
    } catch (err) {
      setError(err instanceof WrongCredentialsError ? "That is not your password." : err instanceof Error ? err.message : "Could not erase the vault.");
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="destructive" onClick={() => { setOpen(true); setPassword(""); setTyped(""); setError(undefined); }}>Erase this vault</Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erase “{meta.name}” from this device?</AlertDialogTitle>
            <AlertDialogDescription>
              Every entry, budget and category in it is deleted. A backup file you saved earlier can still restore it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form onSubmit={erase} className="grid gap-4" noValidate>
            <PasswordField label="Your password" value={password} onChange={setPassword} autoComplete="current-password" error={error} />
            <div className="grid gap-1.5">
              <Label htmlFor="erase-confirm">Type ERASE to confirm</Label>
              <Input id="erase-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Keep vault</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={busy || typed !== "ERASE" || !password}>Erase vault</Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DataTab() {
  const { service, snapshot } = useVault();
  const ledger = useLedger();
  const demo = snapshot.ephemeral;
  const backup = async () => {
    if (!service || !snapshot.meta) return;
    try {
      const { filename, json } = await service.exportBackup(snapshot.meta.id);
      downloadText(filename, json, "application/json");
      toast.success("Encrypted backup saved. You need your password or recovery key to open it.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the backup.");
    }
  };
  const csv = () => {
    if (!ledger) return;
    downloadText(`ledger-tracker-all-entries-${ledger.today}.csv`, transactionsToCsv(ledger.transactions, ledger.categoryById, ledger.currency));
    toast.success(`Exported ${ledger.transactions.length} entries`);
  };
  return (
    <>
      <Row title="Encrypted backup" description="A file you can keep anywhere. It is as safe as the vault itself: opening it needs your password or recovery key. Restore it from the lock screen.">
        <Button variant="outline" className="gap-2" onClick={() => void backup()} disabled={demo}><Download className="h-4 w-4" aria-hidden />Download backup</Button>
      </Row>
      <Row title="Spreadsheet export" description="All entries as a CSV file. This file is NOT encrypted - store it carefully.">
        <Button variant="outline" className="gap-2" onClick={csv}><FileDown className="h-4 w-4" aria-hidden />Export all entries (CSV)</Button>
      </Row>
      <Row title="Storage" description="Browsers can clear site data under pressure. Asking for persistent storage lowers that risk.">
        <StorageStatus />
      </Row>
      {demo ? null : (
        <Row title="Erase this vault" description="Removes the vault from this device. Needs your password.">
          <EraseVault />
        </Row>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ About */

function About() {
  return (
    <div className="grid max-w-prose gap-4 py-5 text-[0.9375rem] leading-6">
      <p className="flex items-center gap-2 text-base font-medium"><Logo size={28} />Ledger Tracker <span className="figure text-muted-foreground">v{__APP_VERSION__}</span></p>
      <p>A personal money ledger that runs entirely in your browser. There is no account and no server: your entries are encrypted with your password and stored in this browser's IndexedDB.</p>
      <p className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>What that does and does not protect against is written down on the <a className="text-primary underline underline-offset-2" href="/security">security page</a>.</span></p>
      <p className="flex gap-2"><Database className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>The source code is open: <a className="text-primary underline underline-offset-2" href="https://github.com/md8-habibullah/ledger-tracker" rel="noopener noreferrer">github.com/md8-habibullah/ledger-tracker</a>. MIT licence.</span></p>
    </div>
  );
}

/* ------------------------------------------------------------------ Page */

export default function Settings() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const active = TABS.find((t) => t.id === tab)?.id as TabId | undefined;
  if (!active) return <Navigate to="/app/settings/appearance" replace />;
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs value={active} onValueChange={(v) => navigate(`/app/settings/${v}`)}>
        <TabsList className="mb-2 h-auto w-full justify-start overflow-x-auto bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <RuleSection title={TABS.find((t) => t.id === active)!.label} className="border-t-border">
        {active === "appearance" ? <Appearance /> : active === "security" ? <Security /> : active === "data" ? <DataTab /> : <About />}
      </RuleSection>
    </>
  );
}
