import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { Category } from "@/db/repo";
import { Glow } from "@/components/fx/Glow";
import { categoryIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/** Square swatch with the category icon. White glyph on a mid-tone passes the 3:1 graphics bar. */
export function CategoryMark({ category, size = 24, className }: { category?: Pick<Category, "color" | "icon">; size?: number; className?: string }) {
  const Icon = categoryIcon(category?.icon);
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-md text-white shadow-[inset_0_1px_0_hsl(0_0%_100%/0.28),0_4px_12px_-4px_var(--mark)]", className)}
      style={{ width: size, height: size, backgroundColor: category?.color ?? "#6D7987", ["--mark" as string]: category?.color ?? "#6D7987" }}
    >
      <Icon size={Math.round(size * 0.62)} strokeWidth={2} />
    </span>
  );
}

export function CategoryChip({ category, className }: { category?: Category; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-2", className)}>
      <CategoryMark category={category} size={20} />
      <span className="truncate">{category ? category.name : "Unknown category"}</span>
      {category?.archived ? <span className="shrink-0 text-xs text-muted-foreground">(archived)</span> : null}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass relative overflow-hidden px-6 py-12 md:px-12 md:py-16", className)}>
      <Glow className="-right-20 -top-24 h-72 w-72 opacity-60" />
      <div className="relative z-10 flex max-w-xl flex-col items-start gap-4">
        {Icon ? (
          <span className="grid h-12 w-12 place-items-center rounded-md bg-foreground/[0.06] text-primary shadow-[0_0_0_1px_hsl(var(--foil-2)/0.4)_inset]">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        ) : null}
        <h3 className="text-2xl">{title}</h3>
        {children ? <p className="leading-7 text-muted-foreground">{children}</p> : null}
        {action}
      </div>
    </div>
  );
}

/** Page title block: informational heading, optional supporting line and actions. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.9rem,3.4vw,2.75rem)] leading-[1.05] tracking-[-0.03em]">{title}</h1>
        {description ? <p className="mt-2 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** A glass panel with a heading: the app's standard section. */
export function RuleSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("glass min-w-0 p-5 md:p-6", className)}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-xl">{title}</h2>
          {description ? <p className="mt-0.5 text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm bg-foreground/[0.08] px-1.5 py-px font-mono text-[11px] leading-4 text-muted-foreground shadow-[0_0_0_1px_hsl(var(--foreground)/0.14)_inset]">{children}</kbd>
  );
}
