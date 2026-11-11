import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PasswordField, UsernameHint } from "@/components/auth/PasswordField";
import { RecoveryKeyPanel } from "@/components/auth/RecoveryKeyPanel";
import { Splash } from "@/components/layout/Splash";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/money";
import { cn } from "@/lib/utils";
import { WeakPasswordError } from "@/vault/service";
import { useStartVault, useVault } from "@/vault/VaultProvider";

type Step = "name" | "password" | "recovery";
const STEPS: { id: Step; label: string }[] = [
  { id: "name", label: "Name it" },
  { id: "password", label: "Set a password" },
  { id: "recovery", label: "Save your recovery key" },
];

export default function Create() {
  useStartVault();
  const { phase, service, vaults, refresh } = useVault();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("My ledger");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ name?: string; password?: string; confirm?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [ack, setAck] = useState<"saved" | "skip" | null>(null);

  if (phase === "booting") return <Splash />;

  const toPassword = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length === 0) { setErrors({ name: "Give the vault a name." }); return; }
    setErrors({});
    setStep("password");
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!service) return;
    if (password !== confirm) { setErrors({ confirm: "The two passwords do not match." }); return; }
    setErrors({});
    setBusy(true);
    try {
      const result = await service.create({ name, password, currency });
      setRecoveryKey(result.recoveryKey);
      setPassword(""); setConfirm("");
      await refresh();
      setStep("recovery");
    } catch (err) {
      if (err instanceof WeakPasswordError) setErrors({ password: err.message });
      else setErrors({ form: err instanceof Error ? err.message : "Could not create the vault." });
    } finally {
      setBusy(false);
    }
  };

  const index = STEPS.findIndex((s) => s.id === step);
  return (
    <div className="glass mx-auto my-8 grid w-[min(34rem,calc(100%-2rem))] gap-8 p-7 md:my-12 md:p-9">
      <div>
        <ol className="mb-7 grid grid-cols-3 gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.id} aria-current={i === index ? "step" : undefined} className={cn("relative pt-3 text-sm before:absolute before:inset-x-0 before:top-0 before:h-1 before:rounded-full", i <= index ? "font-medium before:bg-gradient-to-r before:from-foil-1 before:to-foil-2 before:shadow-[0_0_12px_-1px_hsl(var(--foil-2)/0.7)]" : "text-muted-foreground before:bg-foreground/10")}>
              {s.label}
            </li>
          ))}
        </ol>
        <h1 className="text-[1.75rem] leading-9">
          {step === "name" ? "Create your vault" : step === "password" ? "Choose a password" : "Save your recovery key"}
        </h1>
        {vaults.length > 0 && step === "name" ? (
          <p className="mt-1 text-muted-foreground">You already have a vault on this device. This creates a separate one.</p>
        ) : null}
      </div>

      {step === "name" ? (
        <form onSubmit={toPassword} className="grid gap-5" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="vault-name">Vault name</Label>
            <Input id="vault-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus aria-invalid={!!errors.name} className="h-11" />
            {errors.name ? <p className="text-sm text-destructive">{errors.name}</p> : <p className="text-sm text-muted-foreground">Shown on the lock screen, so keep it neutral.</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vault-currency">Currency</Label>
            <Select name="currency" value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="vault-currency" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} - {c.name} ({c.symbol})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="ghost"><Link to="/">Cancel</Link></Button>
            <Button type="submit" size="lg">Continue</Button>
          </div>
        </form>
      ) : null}

      {step === "password" ? (
        <form onSubmit={create} className="grid gap-5" noValidate>
          <UsernameHint name={name.trim()} />
          <p className="max-w-prose text-muted-foreground">
            This password encrypts your ledger on this device. It is never stored or sent anywhere, so <strong className="font-semibold text-foreground">no one can reset it for you</strong>. Pick something you can remember, such as a few unrelated words.
          </p>
          <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" error={errors.password} meter autoFocus hint="At least 10 characters." />
          <PasswordField label="Repeat password" value={confirm} onChange={setConfirm} autoComplete="new-password" error={errors.confirm} />
          {errors.form ? <p className="text-sm text-destructive" role="alert">{errors.form}</p> : null}
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={() => setStep("name")} disabled={busy}>Back</Button>
            <Button type="submit" size="lg" disabled={busy || !password || !confirm}>{busy ? "Encrypting…" : "Create vault"}</Button>
          </div>
        </form>
      ) : null}

      {step === "recovery" ? (
        <div className="grid gap-5">
          <p className="max-w-prose text-muted-foreground">
            Your vault is created and open. If you ever forget the password, this recovery key is the only way back in. It is shown once and is not stored anywhere.
          </p>
          <RecoveryKeyPanel recoveryKey={recoveryKey} vaultName={name} />
          <fieldset className="grid gap-3 border-t border-foreground/10 pt-4">
            <legend className="sr-only">Recovery key confirmation</legend>
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox checked={ack === "saved"} onCheckedChange={(on) => setAck(on ? "saved" : null)} className="mt-0.5" />
              <span>I saved my recovery key somewhere safe, away from this device.</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-muted-foreground">
              <Checkbox checked={ack === "skip"} onCheckedChange={(on) => setAck(on ? "skip" : null)} className="mt-0.5" />
              <span>I am skipping this. I understand that if I forget my password, my data cannot be recovered.</span>
            </label>
          </fieldset>
          <div className="flex justify-end">
            <Button size="lg" disabled={!ack} onClick={() => navigate("/app", { replace: true })}>Open my vault</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
