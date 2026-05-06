import type { MetadataRoute } from "next";

export const dynamic = "force-static";

/**
 * Robots policy.
 *
 * Funnel + private surfaces are kept OUT of search indexes — only the
 * marketing /readings/<slug> pages and the home page are meant to rank.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://storyincolor.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/face-rating", "/r", "/admin/", "/dashboard/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
