import type { Metadata } from "next";

/**
 * Even the browser tab distinguishes the two lenses (§3b). Someone screen-
 * sharing in a client call should be able to tell at a glance which side they
 * are on, without reading the page.
 */
export const metadata: Metadata = {
  title: "Studio — internal",
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
