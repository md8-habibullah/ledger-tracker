import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { estimateStrength } from "@/lib/password";
import { cn } from "@/lib/utils";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  error?: string;
  /** Show the strength meter (for choosing a new password). */
  meter?: boolean;
  autoFocus?: boolean;
  hint?: string;
}

/**
 * A visually hidden username for password forms. Password managers need one to save and
 * fill the vault password; the vault's name serves as the account name. It is never submitted anywhere.
 */
export function UsernameHint({ name }: { name: string }) {
  return <input type="text" name="username" autoComplete="username" value={name} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />;
}

const LEVEL_CLASS =["bg-destructive", "bg-destructive", "bg-foreground/50", "bg-primary", "bg-primary"];

export function PasswordField({ label, value, onChange, autoComplete, error, meter, autoFocus, hint }: PasswordFieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const strength = meter ? estimateStrength(value) : null;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={`${id}-help`}
          className="h-11 pr-11"
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="absolute right-1 top-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-band hover:text-foreground"
        >
          {shown ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      <div id={`${id}-help`} aria-live="polite">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!error && strength && value ? (
          <div className="grid gap-1">
            <div className="flex gap-1" aria-hidden>
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={cn("h-1 flex-1 rounded-sm", strength.score >= n ? LEVEL_CLASS[strength.score] : "bg-band")} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{strength.label}.</span> {strength.hint}
            </p>
          </div>
        ) : null}
        {!error && !value && hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}
