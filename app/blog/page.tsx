import { blogPosts } from '@/lib/blog-posts'

import { compareDesc } from 'date-fns'
import { BlogCard } from '@/components/blog/BlogCard'
import { BlogLayout } from '@/components/blog/BlogLayout'

export const metadata = {
  title: 'Blog | StoryInColor',
  description: 'Tips, tutorials, and inspiration for creating beautiful coloring pages from your photos.',
}

export default function BlogPage() {
  const posts = blogPosts.sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)))
  const featuredPosts = posts.filter(post => post.featured)
  const regularPosts = posts.filter(post => !post.featured)

  return (
    <BlogLayout>
      <div className="space-y-12">
        {/* Featured Posts Section */}
        {featuredPosts.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6">Featured Articles</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {featuredPosts.map((post) => (
                <BlogCard key={post.slug} post={post} featured />
              ))}
            </div>
          </section>
        )}

        {/* Regular Posts Section */}
        {regularPosts.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6">Latest Articles</h2>
            <div className="grid gap-6 md:grid-cols-1">
              {regularPosts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          </section>
        )}

        {/* Call to Action */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">Eleven AI photo tools. One upload. Pick yours.</h3>
          <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
            From print-ready coloring pages to a magazine-style palm reading,
            StoryInColor turns one photo into a finished, share-ready result in
            roughly 20 to 40 seconds.
          </p>
          <a
            href="/tools"
            className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-medium transition-colors"
          >
            Browse all tools
          </a>
        </div>
      </div>
    </BlogLayout>
  )
}
