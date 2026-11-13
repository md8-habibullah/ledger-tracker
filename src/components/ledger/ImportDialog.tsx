import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { FileUp, TriangleAlert, Upload } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PasswordField } from "@/components/auth/PasswordField";
import { CorruptVaultError, InvalidBackupError, InvalidRecoveryKeyError, WrongCredentialsError, parseBackup } from "@/crypto/envelope";
import { parseRecoveryKey } from "@/crypto/recovery";
import { applyImport, undoImport } from "@/db/importer";
import { FutureSchemaError } from "@/db/schema";
import { MAX_IMPORT_BYTES, type ImportProblem, ImportFileError, parseLedgerCsv } from "@/lib/csvImport";
import { type ImportSource, isEmptyPlan, planImport } from "@/lib/importPlan";
import { currencyInfo, formatMoney } from "@/lib/money";
import { useVault } from "@/vault/VaultProvider";
import { useLedger, useMutate } from "@/vault/useLedger";

/**
 * "Import entries (CSV)" and "Import from backup" share one flow: pick a file, (for a backup) open it with its own
 * password or recovery key, look at exactly what would change, then confirm. Nothing is written before the
 * confirm, the write is one atomic step, and the toast that follows has an Undo.
 */

type Origin = "csv" | "backup";

interface Preview {
  origin: Origin;
  fileName: string;
  /** The vault name inside a backup (display only). */
  backupName: string | null;
  source: ImportSource;
  problems: ImportProblem[];
}

type Stage =
  | { step: "credentials"; fileName: string; json: string; backupName: string | null }
  | { step: "preview"; preview: Preview }
  | { step: "error"; message: string };

const PREVIEW_ROWS = 6;
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

function explainBackupError(error: unknown): string {
  if (error instanceof WrongCredentialsError) return "That is not this backup's password or recovery key. Use the ones it had when the backup was saved.";
  if (error instanceof InvalidRecoveryKeyError) return "That recovery key looks mistyped. Check it against the one you saved.";
  if (error instanceof CorruptVaultError) return "This backup failed its integrity check, so it is damaged or was changed.";
  if (error instanceof FutureSchemaError || error instanceof InvalidBackupError) return error.message;
  return error instanceof Error ? error.message : "Could not open the backup.";
}

export function ImportButton({ origin, children, variant = "outline", className, disabled }: { origin: Origin; children: string } & Pick<ButtonProps, "variant" | "className" | "disabled">) {
  const { service } = useVault();
  const ledger = useLedger();
  const mutate = useMutate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [secret, setSecret] = useState("");
  const [secretError, setSecretError] = useState<string>();
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [acceptCurrency, setAcceptCurrency] = useState(false);
  const [busy, setBusy] = useState(false);

  const Icon = origin === "csv" ? FileUp : Upload;
  const close = () => {
    if (busy) return;
    setStage(null);
    setSecret("");
    setSecretError(undefined);
    setAcceptCurrency(false);
  };

  // The plan is derived from the vault as it is right now, so what the preview shows is what the confirm writes.
  const existing = useMemo(() => (ledger ? { categories: ledger.allCategories, transactions: ledger.transactions, budgets: ledger.budgets } : null), [ledger]);
  const source = stage?.step === "preview" ? stage.preview.source : null;
  const skipPlan = useMemo(() => (source && existing ? planImport(source, existing, { skipDuplicates: true }) : null), [source, existing]);
  const plan = useMemo(() => (source && existing ? (skipDuplicates ? skipPlan : planImport(source, existing, { skipDuplicates: false })) : null), [source, existing, skipDuplicates, skipPlan]);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !ledger) return;
    setAcceptCurrency(false);
    setSkipDuplicates(true);
    if (file.size > MAX_IMPORT_BYTES) {
      setStage({ step: "error", message: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Files up to ${MAX_IMPORT_BYTES / 1024 / 1024} MB can be imported; split it into smaller files.` });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setStage({ step: "error", message: "The browser could not read that file." });
      return;
    }
    if (origin === "csv") {
      try {
        const parsed = parseLedgerCsv(text, ledger.currency);
        setStage({ step: "preview", preview: { origin, fileName: file.name, backupName: null, source: parsed.source, problems: parsed.problems } });
      } catch (error) {
        setStage({ step: "error", message: error instanceof ImportFileError ? error.message : "That file could not be read as a CSV." });
      }
    } else {
      try {
        const { name } = parseBackup(text);
        setStage({ step: "credentials", fileName: file.name, json: text, backupName: name ?? null });
      } catch {
        setStage({ step: "error", message: "That is not a Ledger Tracker backup. A backup is the .ltvault.json file saved from Settings → Data → Download backup." });
      }
    }
  };

  const openBackup = async (e: FormEvent) => {
    e.preventDefault();
    if (stage?.step !== "credentials" || !service || busy) return;
    if (!secret.trim()) {
      setSecretError("Enter the backup's password or recovery key.");
      return;
    }
    setBusy(true);
    setSecretError(undefined);
    try {
      // A recovery key has a fixed, checksummed shape; anything else is tried as a password.
      const credential = parseRecoveryKey(secret) ? { recoveryKey: secret } : { password: secret };
      const contents = await service.readBackup(stage.json, credential);
      setStage({ step: "preview", preview: { origin, fileName: stage.fileName, backupName: contents.name ?? stage.backupName, source: contents, problems: [] } });
      setSecret("");
    } catch (error) {
      setSecretError(explainBackupError(error));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!plan || busy) return;
    setBusy(true);
    const result = await mutate((db) => applyImport(db, plan));
    setBusy(false);
    if (!result) return; // useMutate has shown why; the dialog stays open so nothing is lost
    setStage(null);
    setAcceptCurrency(false);
    const parts = [plural(result.transactionIds.length, "entry", "entries")];
    if (result.categoryIds.length > 0) parts.push(plural(result.categoryIds.length, "new category", "new categories"));
    if (result.budgetIds.length > 0) parts.push(plural(result.budgetIds.length, "budget", "budgets"));
    toast.success(`Imported ${parts.join(", ")}`, {
      duration: 12000,
      action: { label: "Undo", onClick: () => void mutate((db) => undoImport(db, result), { success: "Import undone" }) },
    });
  };

  const preview = stage?.step === "preview" ? stage.preview : null;
  const currency = ledger?.currency ?? "BDT";
  const fileCurrency = preview?.source.currency ?? null;
  const currencyDiffers = !!fileCurrency && fileCurrency !== currency;
  // A backup holds minor units. With a different number of decimals the same number means a different amount, so it cannot be merged.
  const decimalsDiffer = !!preview && preview.origin === "backup" && !!fileCurrency && currencyInfo(fileCurrency).digits !== currencyInfo(currency).digits;
  const money = (minor: number) => formatMoney(minor, { code: currency });
  const nothing = !!plan && isEmptyPlan(plan);
  const ready = !!plan && !nothing && !decimalsDiffer && (!currencyDiffers || acceptCurrency);

  return (
    <>
      <Button variant={variant} className={className ?? "gap-2"} disabled={disabled || !ledger} onClick={() => fileRef.current?.click()}>
        <Icon className="h-4 w-4" aria-hidden />{children}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept={origin === "csv" ? ".csv,text/csv" : ".json,application/json"}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid={`import-${origin}-input`}
        onChange={(e) => void onFile(e)}
      />

      <Dialog open={stage !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {stage?.step === "error" ? (
            <>
              <DialogHeader>
                <DialogTitle>This file cannot be imported</DialogTitle>
                <DialogDescription>{stage.message}</DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={close}>Close</Button>
                <Button variant="outline" onClick={() => { close(); fileRef.current?.click(); }}>Choose another file</Button>
              </DialogFooter>
            </>
          ) : null}

          {stage?.step === "credentials" ? (
            <form onSubmit={openBackup} className="grid gap-4" noValidate>
              <DialogHeader>
                <DialogTitle>Open the backup</DialogTitle>
                <DialogDescription>
                  {stage.backupName ? <>“{stage.backupName}” is encrypted.</> : "This backup is encrypted."} Enter the password or recovery key it had when it was saved. It is opened here, on this device, and then only its entries are added to this vault.
                </DialogDescription>
              </DialogHeader>
              <PasswordField label="Backup password or recovery key" value={secret} onChange={(v) => { setSecret(v); setSecretError(undefined); }} autoComplete="current-password" error={secretError} autoFocus />
              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
                <Button type="submit" disabled={busy}>{busy ? "Opening…" : "Open backup"}</Button>
              </DialogFooter>
            </form>
          ) : null}

          {preview && plan ? (
            <>
              <DialogHeader>
                <DialogTitle>{preview.origin === "csv" ? "Import entries from CSV" : "Add entries from a backup"}</DialogTitle>
                <DialogDescription className="break-words">
                  {preview.fileName}{preview.backupName ? ` · backup of “${preview.backupName}”` : ""}. Review what will change, then confirm. You can undo it right after.
                </DialogDescription>
              </DialogHeader>

              <dl className="grid grid-cols-3 gap-3 text-center" aria-label="Import summary">
                {[
                  { n: plan.entries.length, label: "to import" },
                  { n: skipPlan?.duplicates ?? 0, label: skipDuplicates ? "already here, skipped" : "already here, kept" },
                  { n: preview.problems.length, label: "rows with problems" },
                ].map(({ n, label }) => (
                  <div key={label} className="flex flex-col-reverse rounded-md border border-border bg-band px-2 py-3">
                    <dt className="mt-1.5 text-sm text-muted-foreground">{label}</dt>
                    <dd className="figure text-2xl leading-none">{n.toLocaleString("en-US")}</dd>
                  </div>
                ))}
              </dl>

              {plan.entries.length > 0 ? (
                <p className="text-sm">
                  Money in <span className="figure">{money(plan.totals.income)}</span> · money out <span className="figure">{money(plan.totals.expense)}</span>
                  {plan.dateRange ? <> · <span className="figure">{plan.dateRange.from}</span> to <span className="figure">{plan.dateRange.to}</span></> : null}
                </p>
              ) : null}

              {plan.newCategories.length > 0 ? (
                <p className="text-sm">
                  <span className="font-medium">{plural(plan.newCategories.length, "new category", "new categories")} will be created: </span>
                  {plan.newCategories.slice(0, PREVIEW_ROWS).map((c) => `${c.name} (${c.kind === "income" ? "money in" : "money out"})`).join(", ")}
                  {plan.newCategories.length > PREVIEW_ROWS ? `, and ${plan.newCategories.length - PREVIEW_ROWS} more` : ""}.
                </p>
              ) : null}
              {plan.budgets.length > 0 || plan.budgetsKept > 0 ? (
                <p className="text-sm">
                  {plan.budgets.length > 0 ? <><span className="font-medium">{plural(plan.budgets.length, "budget", "budgets")}</span> will be added. </> : null}
                  {plan.budgetsKept > 0 ? `${plural(plan.budgetsKept, "budget", "budgets")} you already have stay as they are.` : null}
                </p>
              ) : null}

              {preview.problems.length > 0 ? (
                <div className="grid gap-1.5 rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">{plural(preview.problems.length, "row has a problem and will be skipped", "rows have problems and will be skipped")}</p>
                  <ul className="grid gap-1 text-destructive">
                    {preview.problems.slice(0, PREVIEW_ROWS).map((p) => <li key={p.row}>Row {p.row}: {p.message}</li>)}
                  </ul>
                  {preview.problems.length > PREVIEW_ROWS ? <p className="text-muted-foreground">…and {preview.problems.length - PREVIEW_ROWS} more.</p> : null}
                </div>
              ) : null}

              {decimalsDiffer ? (
                <p className="flex gap-2 rounded-md border border-border p-3 text-sm" role="alert">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>This backup is in {fileCurrency}, which counts {currencyInfo(fileCurrency!).digits} decimal places; this vault uses {currency} with {currencyInfo(currency).digits}. Amounts cannot be carried across safely, so it cannot be added.</span>
                </p>
              ) : currencyDiffers ? (
                <div className="grid gap-2 rounded-md border border-border p-3 text-sm">
                  <p className="flex gap-2">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>This file is in <span className="font-medium">{fileCurrency}</span> but this vault uses <span className="font-medium">{currency}</span>. Amounts are never converted.</span>
                  </p>
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <Checkbox checked={acceptCurrency} onCheckedChange={(on) => setAcceptCurrency(on === true)} className="mt-0.5" />
                    <span>Import the numbers as they are, as {currency}</span>
                  </label>
                </div>
              ) : null}

              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <Checkbox checked={skipDuplicates} onCheckedChange={(on) => setSkipDuplicates(on === true)} className="mt-0.5" />
                <span>Skip entries this vault already has <span className="text-muted-foreground">(same day, type, category, amount and note)</span></span>
              </label>

              {nothing ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {(skipPlan?.duplicates ?? 0) > 0 ? "Everything in this file is already in this vault, so there is nothing to add." : "There is nothing in this file that can be imported."}
                </p>
              ) : null}

              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
                <Button onClick={() => void confirm()} disabled={!ready || busy}>
                  {busy ? "Importing…" : plan.entries.length > 0 ? `Import ${plural(plan.entries.length, "entry", "entries")}` : "Import"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
