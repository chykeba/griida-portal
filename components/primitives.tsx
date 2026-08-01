import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* ==========================================================================
   LOGO
   The one place the brand gradient is allowed to be itself (§6a, §10).
   NOTE: this is a geometric stand-in built to the proportions of the supplied
   mark. Drop the real asset into /public/griida-mark.svg and swap the <svg>
   below — do not recolour or restretch the official mark.
   ========================================================================== */

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 40 40"
        className="h-6 w-6"
        role="img"
        aria-label="Griida"
        fill="none"
      >
        <defs>
          <linearGradient id="griida-mark" x1="6" y1="2" x2="34" y2="38">
            <stop offset="0%" stopColor="var(--color-brand-violet)" />
            <stop offset="32%" stopColor="var(--color-brand-magenta)" />
            <stop offset="68%" stopColor="var(--color-brand-cyan)" />
            <stop offset="100%" stopColor="var(--color-brand-green)" />
          </linearGradient>
        </defs>
        <path d="M14 2h12l8 14-8 6-14-8z" fill="url(#griida-mark)" opacity="0.9" />
        <path d="M2 22l14 8 14-6v10l-14 6-14-8z" fill="url(#griida-mark)" />
      </svg>
      <span className="font-display text-[1.05rem] font-semibold tracking-tight">
        Griida
      </span>
    </span>
  );
}

/* ==========================================================================
   STATUS DOT
   Colour is never the only signal — every dot travels with a text label
   (WCAG: color-not-only).
   ========================================================================== */

export type Tone = "calm" | "caution" | "alert" | "approved" | "neutral";

const toneDot: Record<Tone, string> = {
  calm: "bg-calm",
  caution: "bg-caution",
  alert: "bg-alert",
  approved: "bg-approved",
  neutral: "bg-ink-faint",
};

export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", toneDot[tone], className)}
    />
  );
}

/* ==========================================================================
   LABEL — mono, uppercase, letterspaced. Metadata, never body copy.
   ========================================================================== */

export function Label({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  const toneText: Record<Tone, string> = {
    calm: "text-calm",
    caution: "text-caution",
    alert: "text-alert",
    approved: "text-approved",
    neutral: "text-ink-faint",
  };
  return (
    <span
      className={cn(
        "font-mono text-[0.6875rem] uppercase tracking-[0.14em]",
        toneText[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ==========================================================================
   BADGE
   ========================================================================== */

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const styles: Record<Tone, string> = {
    calm: "border-calm/30 text-calm",
    caution: "border-caution/35 text-caution",
    alert: "border-alert/35 text-alert",
    approved: "border-approved/35 text-approved",
    neutral: "border-rule-strong text-ink-soft",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "font-mono text-[0.6875rem] uppercase tracking-[0.1em] whitespace-nowrap",
        styles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ==========================================================================
   CARD — flat, ruled, confident. No glass, no heavy shadow (§6a).
   ========================================================================== */

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "li" | "section";
}) {
  return (
    <Tag
      className={cn(
        "rounded-lg border border-rule bg-paper-raised",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ==========================================================================
   SECTION HEADING — a ruled editorial header, not a bare h2.
   ========================================================================== */

export function SectionHeading({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-rule pb-2">
      <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">
        {children}
      </h2>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

/* ==========================================================================
   EMPTY STATE — teaches what will appear here, never apologises (§6).
   ========================================================================== */

export function EmptyState({
  headline,
  body,
  icon,
}: {
  headline: string;
  body: string;
  icon?: ReactNode;
}) {
  return (
    <div className="animate-settle rounded-lg border border-dashed border-rule-strong px-5 py-8 text-center">
      {icon ? <div className="mb-3 flex justify-center text-ink-faint">{icon}</div> : null}
      <p className="font-display text-lead font-medium">{headline}</p>
      <p className="mx-auto mt-1.5 max-w-[38ch] text-small leading-relaxed text-ink-soft">
        {body}
      </p>
    </div>
  );
}

/* ==========================================================================
   NOTICE — inline explanation. Cause first, then what happens next.
   ========================================================================== */

export function Notice({
  tone = "neutral",
  title,
  children,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
}) {
  const styles: Record<Tone, string> = {
    calm: "border-calm/25 bg-calm/[0.04]",
    caution: "border-caution/30 bg-caution/[0.05]",
    alert: "border-alert/30 bg-alert/[0.05]",
    approved: "border-approved/25 bg-approved/[0.04]",
    neutral: "border-rule bg-paper-sunk",
  };
  return (
    <div className={cn("rounded-md border px-3.5 py-3", styles[tone])}>
      <p className="flex items-center gap-2 text-small font-medium">
        <StatusDot tone={tone} />
        {title}
      </p>
      {children ? (
        <div className="mt-1 pl-4 text-small leading-relaxed text-ink-soft">{children}</div>
      ) : null}
    </div>
  );
}
