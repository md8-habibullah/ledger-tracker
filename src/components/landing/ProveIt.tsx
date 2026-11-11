import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Seal } from "@/components/ledger/Seal";
import { toHex, utf8 } from "@/crypto/bytes";
import { WrongCredentialsError, createVaultEnvelope, unlockWithPassword } from "@/crypto/envelope";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ live encryption demo */

const SAMPLE_PASSWORD = "sample-password-123";
// First 16 bytes of every plain SQLite file: "SQLite format 3\0".
const SQLITE_HEADER = new Uint8Array([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00]);

interface SealedSample {
  plainHex: string;
  cipherHex: string;
  size: number;
  envelope: Awaited<ReturnType<typeof createVaultEnvelope>>["envelope"];
}

function SealDemo() {
  const [text, setText] = useState("Salary 85,000");
  const [busy, setBusy] = useState(false);
  const [sealed, setSealed] = useState<SealedSample | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const seal = async () => {
    setBusy(true);
    setResult(null);
    try {
      const body = utf8(text || " ");
      const plaintext = new Uint8Array(SQLITE_HEADER.length + body.length);
      plaintext.set(SQLITE_HEADER, 0);
      plaintext.set(body, SQLITE_HEADER.length);
      // The very same function the app uses for real vaults, with the production key-stretching cost.
      const { envelope } = await createVaultEnvelope({ vaultId: "sample", password: SAMPLE_PASSWORD, plaintext: plaintext as ReturnType<typeof utf8> });
      setSealed({ plainHex: toHex(plaintext, 16), cipherHex: toHex(envelope.data.ct, 16), size: envelope.data.ct.length, envelope });
    } finally {
      setBusy(false);
    }
  };

  const attempt = async (password: string) => {
    if (!sealed) return;
    setBusy(true);
    try {
      const { plaintext } = await unlockWithPassword(sealed.envelope, password);
      setResult(`Opened with “${password}”. Recovered: ${new TextDecoder().decode(plaintext.subarray(SQLITE_HEADER.length))}`);
    } catch (e) {
      setResult(e instanceof WrongCredentialsError ? `Rejected: “${password}” does not open it. The authentication check failed, and nothing was revealed.` : "Failed.");
    } finally {
      setBusy(false);
    }
  };

  // The "before" bytes follow the text live; the "after" bytes appear once the real encryption has run.
  const liveBody = utf8(text || " ");
  const livePlain = new Uint8Array(SQLITE_HEADER.length + liveBody.length);
  livePlain.set(SQLITE_HEADER, 0);
  livePlain.set(liveBody, SQLITE_HEADER.length);

  return (
    <section aria-labelledby="seal-title" className="grid gap-6 lg:grid-cols-2 lg:gap-10">
      <div className="grid content-start gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 id="seal-title" className="text-xl">Seal a sample right now</h3>
          <p className="mt-2 text-muted-foreground">Runs the app's real encryption code in this tab, with the real key-stretching cost. Nothing leaves your browser.</p>
        </div>
        <Seal size={56} glow state={sealed ? "sealed" : "open"} className="mt-1" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sample-text">Something to protect</Label>
        <div className="flex gap-2">
          <Input id="sample-text" value={text} maxLength={80} onChange={(e) => { setText(e.target.value); setSealed(null); setResult(null); }} />
          <Button onClick={() => void seal()} disabled={busy}>{busy && !sealed ? "Sealing…" : "Seal it"}</Button>
        </div>
      </div>
      </div>

      <div className="grid content-start gap-4">
      <dl className="well grid gap-3 p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Before: first 16 bytes of a plain database file</dt>
          <dd className="figure whitespace-normal break-words text-xs" translate="no">{sealed ? sealed.plainHex : toHex(livePlain, 16)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{sealed ? `After: first 16 bytes of what is stored (${sealed.size} bytes in all)` : "After: what is stored"}</dt>
          <dd className={cn("figure whitespace-normal break-words text-xs", sealed ? "text-primary" : "text-muted-foreground")} translate="no">
            {sealed ? sealed.cipherHex : "Press “Seal it” to encrypt this text."}
          </dd>
        </div>
      </dl>

      {sealed ? (
        <div className="grid gap-3 animate-settle">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void attempt("wrong-password-1")}>Try a wrong password</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void attempt(SAMPLE_PASSWORD)}>Try the right one ({SAMPLE_PASSWORD})</Button>
          </div>
          {result ? <p role="status" className="text-sm">{result}</p> : null}
        </div>
      ) : null}
      </div>
    </section>
  );
}

/** The proof: real encryption you can run, live in the page. */
export function ProveIt({ className }: { className?: string }) {
  return (
    <div className={cn("glass p-5 md:p-8", className)}>
      <SealDemo />
    </div>
  );
}
