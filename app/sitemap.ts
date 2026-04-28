import { TOOLS } from '@/lib/tools/registry'

export const dynamic = 'force-static'

// Use a fixed lastModified date for routes that don't change per-build.
// `new Date()` here would write a fresh timestamp on every deploy and confuse
// crawl signals — Google interprets it as "this page changed" even when the
// content is identical.
const SITE_LAST_MODIFIED = new Date('2026-04-28')

export default function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://storyincolor.com'

  const staticPages = [
    { url: baseUrl, lastModified: SITE_LAST_MODIFIED, changeFrequency: 'weekly' as const, priority: 1.0 },
    { url: `${baseUrl}/contact`, lastModified: SITE_LAST_MODIFIED, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${baseUrl}/privacy`, lastModified: SITE_LAST_MODIFIED, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${baseUrl}/terms`, lastModified: SITE_LAST_MODIFIED, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${baseUrl}/readings`, lastModified: SITE_LAST_MODIFIED, changeFrequency: 'weekly' as const, priority: 0.95 },
  ]

  // Reading pages share the site's lastModified — content only changes when
  // the registry is re-deployed.
  const readingPages = TOOLS.map((t) => ({
    url: `${baseUrl}/readings/${t.slug}`,
    lastModified: SITE_LAST_MODIFIED,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }))

  return [...staticPages, ...readingPages]
}
