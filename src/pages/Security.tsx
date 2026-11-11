import { Link } from "react-router-dom";
import { DEFAULT_PBKDF2_ITERATIONS } from "@/crypto/envelope";
import { SITE } from "@/config/site";

const TABLE: { threat: string; verdict: "Protected" | "Not protected" | "Partly"; detail: string }[] = [
  { threat: "Someone copies your browser's stored data (stolen laptop, shared computer, cloud backup of a profile)", verdict: "Protected", detail: "They get ciphertext. Opening it needs your password or recovery key, and each guess costs a full key-stretching round. A weak password is still a weak password." },
  { threat: "Someone opens the site on your device while the vault is locked", verdict: "Protected", detail: "The lock screen shows only the vault name. Without the password nothing is decrypted." },
  { threat: "You walk away with the vault unlocked", verdict: "Partly", detail: "Auto-lock locks it after inactivity (5 minutes by default) and reloads the page to discard decrypted data. Until then, whoever sits down can read it." },
  { threat: "Malware, a screen recorder or a hostile browser extension on your device", verdict: "Not protected", detail: "Software that can read the page or your keystrokes sees what you see. No web app can prevent this." },
  { threat: "The website serving the code is compromised or changed", verdict: "Not protected", detail: "The encryption code is downloaded from the host each time. A malicious change could capture your password. The mitigations are open source, a strict Content-Security-Policy, and the option to build and host it yourself." },
  { threat: "A server breach", verdict: "Protected", detail: "There is no server holding your data, so there is nothing there to breach." },
  { threat: "Forgetting your password", verdict: "Not protected", detail: "Nobody can reset it. The recovery key is the only second way in. Without both, the data is gone." },
  { threat: "The browser clearing site data", verdict: "Not protected", detail: "Browsers may clear storage under pressure. You can request persistent storage in Settings, and you should keep an encrypted backup file." },
];

export default function Security() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 md:px-8 md:py-16">
      <h1 className="text-[clamp(2rem,4.6vw,3.1rem)] leading-[1.08]">Security, and its limits</h1>
      <p className="mb-9 mt-4 max-w-prose text-base leading-6 text-muted-foreground">
        This page says what Ledger Tracker does, how you can check it, and what it cannot do. It has not been independently audited. Read the code and judge for yourself.
      </p>

      <section className="glass mt-5 grid gap-4 p-6 md:p-8" aria-labelledby="how">
        <h2 id="how" className="text-xl">How your data is protected</h2>
        <ol className="grid max-w-prose list-decimal gap-3 pl-5 leading-6">
          <li>When you create a vault, the browser generates a random 256-bit <strong>vault key</strong>. Your entries are stored in a SQLite database, and that database is encrypted with the vault key using AES-256-GCM. Each save uses a fresh random nonce.</li>
          <li>The vault key itself is never stored in the clear. It is <strong>wrapped</strong> (encrypted) by a key derived from your password with PBKDF2-HMAC-SHA256 and {DEFAULT_PBKDF2_ITERATIONS.toLocaleString("en-US")} iterations and a random salt. A second wrapping uses your 160-bit recovery key.</li>
          <li>Nothing derived from your password is stored for checking it. A wrong password is detected because decryption fails its authentication check.</li>
          <li>While the vault is open, the decrypted database lives in this tab's memory and the key is held as a non-extractable browser key. Locking closes the database and reloads the page.</li>
          <li>Changing your password re-wraps the vault key; it does not need to re-encrypt your data. All headers are authenticated, so swapping or editing them makes decryption fail.</li>
        </ol>
        <p className="max-w-prose text-muted-foreground">All of this runs in your browser with the standard Web Crypto API. There is no custom cryptography.</p>
      </section>

      <section className="glass mt-5 grid gap-4 p-6 md:p-8" aria-labelledby="threats">
        <h2 id="threats" className="text-xl">What it does and does not defend against</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <caption className="sr-only">Threats and how Ledger Tracker handles each</caption>
            <thead>
              <tr className="border-b border-foreground/10 text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-normal">Situation</th>
                <th scope="col" className="w-32 py-2 pr-4 font-normal">Verdict</th>
                <th scope="col" className="py-2 font-normal">Why</th>
              </tr>
            </thead>
            <tbody className="bands align-top">
              {TABLE.map((r) => (
                <tr key={r.threat}>
                  <td className="px-2 py-3 pr-4 leading-6">{r.threat}</td>
                  <td className="px-2 py-3 pr-4 font-medium">{r.verdict}</td>
                  <td className="px-2 py-3 leading-6 text-muted-foreground">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass mt-5 grid gap-4 p-6 md:p-8" aria-labelledby="visible">
        <h2 id="visible" className="text-xl">What is visible without your password</h2>
        <p className="max-w-prose leading-6">The vault's name, its identifier, the size of the encrypted data, how many times it has been saved and when. Entry amounts, notes, categories and budgets are inside the encrypted data. Outside the vault, in the browser's local storage, the site keeps your theme, row density, auto-lock choice and which vault you opened last. You can look at exactly what is stored in Settings, Security, once you are signed in.</p>
      </section>

      <section className="glass mt-5 grid gap-4 p-6 md:p-8" aria-labelledby="verify">
        <h2 id="verify" className="text-xl">How to verify it</h2>
        <ul className="grid max-w-prose list-disc gap-2 pl-5 leading-6">
          <li>Developer tools, Network tab: add entries and look for any request carrying them. There should be none.</li>
          <li>Developer tools, Application, IndexedDB: the stored vault is encoded ciphertext, with no readable notes or category names.</li>
          <li>The <Link className="text-primary underline underline-offset-2" to="/">home page</Link> runs the encryption on a sample you type.</li>
          <li>The response headers include a Content-Security-Policy that limits where the page may connect. Check it in the Network tab under the main document.</li>
          <li>Read, build and host the code yourself: <a className="text-primary underline underline-offset-2" href={SITE.repoUrl} rel="noopener noreferrer">{SITE.repoUrl.replace("https://", "")}</a>.</li>
        </ul>
        <p className="max-w-prose text-muted-foreground">If the site you are viewing adds analytics at the hosting level, the Network tab will show it. Your entries are never part of any request either way.</p>
      </section>

      <section className="glass mt-5 grid gap-4 p-6 md:p-8" aria-labelledby="report">
        <h2 id="report" className="text-xl">Found a problem?</h2>
        <p className="max-w-prose leading-6">Please report security issues privately through a GitHub security advisory on <a className="text-primary underline underline-offset-2" href={`${SITE.repoUrl}/security/advisories/new`} rel="noopener noreferrer">the repository</a>, rather than in a public issue.</p>
      </section>
    </article>
  );
}
