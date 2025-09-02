import { blogPosts } from '@/lib/blog-posts'

// Use shared blog posts data

import { notFound } from 'next/navigation'
import { BlogLayout } from '@/components/blog/BlogLayout'
import { BlogPostContent } from '@/components/blog/BlogPostContent'

interface PageProps {
  params: {
    slug: string
  }
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }))
}

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params
  const post = blogPosts.find((post) => post.slug === resolvedParams.slug)

  if (!post) {
    return {
      title: 'Blog | StoryInColor',
      description: 'Tips, tutorials, and inspiration for creating beautiful coloring pages from your photos.',
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://storyincolor.com'
  const canonicalUrl = `${baseUrl}${post.url}`

  // Create SEO-optimized title with keywords
  const seoTitle = `${post.title} | StoryInColor Blog`

  // Enhanced description with keywords
  const seoDescription = post.description.length > 160
    ? post.description.substring(0, 157) + '...'
    : post.description

  // Generate keywords from tags and content
  const keywords = post.tags?.join(', ') || 'coloring pages, photo to coloring, custom coloring books, AI coloring pages'

  return {
    title: seoTitle,
    description: seoDescription,

    // Basic meta tags
    keywords,
    authors: [{ name: post.author }],
    creator: post.author,
    publisher: 'StoryInColor',

    // Open Graph
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      url: canonicalUrl,
      siteName: 'StoryInColor',
      type: 'article',
      locale: 'en_US',
      publishedTime: post.date,
      modifiedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      images: [{
        url: `${baseUrl}/images/SHARING.webp`,
        width: 1200,
        height: 630,
        alt: post.title,
      }],
    },

    // Twitter Card
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description: seoDescription,
      creator: '@storyincolor',
      site: '@storyincolor',
    },

    // Article specific metadata
    other: {
      'article:author': post.author,
      'article:published_time': post.date,
      'article:modified_time': post.date,
      'article:section': 'Blog',
      'article:tag': post.tags?.join(',') || '',
      'author': post.author,
      'keywords': keywords,
    },

    // Canonical URL
    alternates: {
      canonical: canonicalUrl,
    },

    // Robots and additional meta
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

// Structured data component for blog posts
interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  author: string
  tags: string[]
  featured?: boolean
  readTime?: number
  url: string
  content?: string
}

function BlogPostStructuredData({ post }: { post: BlogPost }) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://storyincolor.com'
  const canonicalUrl = `${baseUrl}${post.url}`

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.description,
    "author": {
      "@type": "Person",
      "name": post.author
    },
    "publisher": {
      "@type": "Organization",
      "name": "StoryInColor",
      "url": baseUrl,
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/images/SHARING.webp`,
        "width": 1200,
        "height": 630
      }
    },
    "datePublished": post.date,
    "dateModified": post.date,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": canonicalUrl
    },
    "url": canonicalUrl,
    "image": {
      "@type": "ImageObject",
      "url": `${baseUrl}/images/SHARING.webp`,
      "width": 1200,
      "height": 630,
      "caption": post.title
    },
    "keywords": post.tags?.join(', '),
    "articleSection": "Blog",
    "timeRequired": post.readTime ? `PT${post.readTime}M` : undefined,
    "wordCount": post.content ? post.content.split(/\s+/).length : undefined,
    "inLanguage": "en-US",
    "isFamilyFriendly": true,
    "copyrightHolder": {
      "@type": "Organization",
      "name": "StoryInColor"
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData),
      }}
    />
  )
}

export default async function BlogPostPage({ params }: PageProps) {
  const resolvedParams = await params
  const post = blogPosts.find((post) => post.slug === resolvedParams.slug)

  if (!post) {
    notFound()
  }

  return (
    <BlogLayout>
      <BlogPostStructuredData post={post} />
      <BlogPostContent post={post} />
    </BlogLayout>
  )
}
