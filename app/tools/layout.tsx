import type { ReactNode } from "react";

// Public layout: pages under /tools render for both authenticated and
// unauthenticated visitors so search engines can crawl per-tool SEO content.
// The auth gate now lives inside each tool's workflow component.
export default function ToolsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
