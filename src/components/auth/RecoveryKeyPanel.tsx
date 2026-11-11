import { Copy, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadText } from "@/lib/csv";

/**
 * Shows a recovery key once. It is the only way back in if the password is forgotten:
 * there is no server and no reset email, by design.
 */
export function RecoveryKeyPanel({ recoveryKey, vaultName }: { recoveryKey: string; vaultName: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      toast.success("Copied. Paste it somewhere safe, then clear your clipboard.");
    } catch {
      toast.error("Could not copy. Select the key and copy it by hand.");
    }
  };
  const save = () =>
    downloadText(
      "ledger-tracker-recovery-key.txt",
      `Ledger Tracker recovery key\nVault: ${vaultName}\n\n${recoveryKey}\n\nKeep this file offline. It is the only way to open the vault if you forget the password.\nAnyone who has this key AND a copy of your vault data can read it.\n`,
      "text/plain;charset=utf-8",
    );

  const groups = recoveryKey.split("-");
  return (
    <div className="print-area grid gap-4">
      <p className="hidden print:block text-lg font-semibold">Ledger Tracker recovery key · {vaultName}</p>
      <div className="rounded-md border border-border bg-band p-4" aria-label="Recovery key">
        <p className="figure grid grid-cols-3 gap-x-4 gap-y-2 text-lg tracking-wider sm:grid-cols-5" translate="no">
          {groups.map((g, i) => (
            <span key={i}>{g}</span>
          ))}
        </p>
      </div>
      <div className="no-print flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="gap-2" onClick={() => void copy()}><Copy className="h-4 w-4" aria-hidden />Copy</Button>
        <Button type="button" variant="outline" className="gap-2" onClick={save}><Download className="h-4 w-4" aria-hidden />Save as file</Button>
        <Button type="button" variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />Print</Button>
      </div>
    </div>
  );
}
