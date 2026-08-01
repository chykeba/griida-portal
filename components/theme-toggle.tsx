"use client";

import { Moon, Sun } from "lucide-react";

/**
 * Light is the default and the intended look. This exists because some people
 * genuinely prefer dark and shouldn't have to fight the interface — not because
 * every app has a moon icon in the corner.
 *
 * Deliberately stateless: which icon shows is decided by CSS from the
 * `data-theme` attribute the root layout has already set. No React state, no
 * effect, so there is no hydration mismatch and no flicker on first paint.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("griida-theme", next);
    } catch {
      // Private browsing — the choice just won't persist. Not worth surfacing.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark"
      title="Switch between light and dark"
      className="pressable -mr-2 flex size-11 items-center justify-center rounded-md text-ink-faint hover:text-ink"
    >
      <Moon className="size-4 when-light" strokeWidth={1.75} aria-hidden />
      <Sun className="size-4 when-dark" strokeWidth={1.75} aria-hidden />
    </button>
  );
}
