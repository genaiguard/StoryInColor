import { blogPosts } from '@/lib/blog-posts'
import { TOOLS } from '@/lib/tools/registry'

export const dynamic = 'force-static'

// Use a fixed lastModified date for routes that don't actually change
// per-build. `new Date()` here would write a fresh timestamp on every
// deploy and confuse crawl signals — Google interprets it as "this page
// changed" even when the content is identical.
const SITE_LAST_MODIFIED = new Date('2026-04-27')

export default function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://storyincolor.com'

  const staticPages = [
    { url: baseUrl, lastModified: SITE_LAST_MODIFIED, changeFrequency: 'weekly' as const, priority: 1.0 },
    { url: `${baseUrl}/contact`, lastModified: SITE_LAST_MODIFIED, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${baseUrl}/privacy`, lastModified: SITE_LAST_MODIFIED, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${baseUrl}/terms`, lastModified: SITE_LAST_MODIFIED, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${baseUrl}/blog`, lastModified: SITE_LAST_MODIFIED, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/tools`, lastModified: SITE_LAST_MODIFIED, changeFrequency: 'weekly' as const, priority: 0.95 },
  ]

  // Blog posts use their own publication date
  const blogPages = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority: post.featured ? 0.8 : 0.6,
  }))

  // Tool pages share the site's lastModified — content only changes when
  // the registry is re-deployed.
  const toolPages = TOOLS.map((t) => ({
    url: `${baseUrl}/tools/${t.slug}`,
    lastModified: SITE_LAST_MODIFIED,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }))

  return [...staticPages, ...blogPages, ...toolPages]
}
