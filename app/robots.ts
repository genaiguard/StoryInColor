import type { MetadataRoute } from "next";

export const dynamic = "force-static";

/**
 * Robots policy.
 *
 * Quiz funnel routes (/quiz/*) are paid-traffic landing surfaces — not SEO
 * pages. We deliberately keep them OUT of search indexes:
 *   - The pages themselves set robots: { index: false, follow: false } in
 *     their metadata (see app/quiz/[slug]/page.tsx).
 *   - The sitemap (app/sitemap.ts) does NOT include /quiz/*.
 *   - This robots.txt adds a Disallow directive as a third belt-and-braces.
 *
 * Why exclude rather than include: routing organic SEO traffic to /quiz/*
 * would (a) split SEO juice with /readings/<slug> (the marketing surface
 * that ranks), and (b) bypass the long-form catalog narrative organic users
 * actually want to read before clicking "Start a reading".
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://storyincolor.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/quiz/", "/admin/", "/dashboard/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
