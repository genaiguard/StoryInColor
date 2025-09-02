import React from 'react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface BlogPost {
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

interface BlogPostContentProps {
  post: BlogPost
}



export function BlogPostContent({ post }: BlogPostContentProps) {
  return (
    <article className="max-w-none">
      {/* Back Link */}
      <div className="mb-6">
        <Link className="inline-flex items-center gap-2 text-orange-500 hover:text-orange-600 font-medium transition-colors" href="/blog">
          <span>←</span>
          <span>Back to Blog</span>
        </Link>
      </div>

      {/* Header */}
      <header className="mb-8">
        <div className="flex gap-2 mb-4">
          {post.tags?.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>

        <h1 className="text-4xl font-bold mb-2 text-gray-900">{post.title}</h1>

        <div className="flex items-center gap-4 text-gray-600 mb-6">
          <span>By {post.author}</span>
          <span>{format(new Date(post.date), 'MMMM d, yyyy')}</span>
          {post.readTime && <span>{post.readTime} minute read</span>}
        </div>
      </header>

      {/* Content */}
      <div className="mb-12 prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-em:text-gray-700 prose-headings:font-bold">
        {post.content ? (
          <div
            dangerouslySetInnerHTML={{
              __html: post.content
                // Process content line by line to handle different elements
                .split('\n')
                .map(line => {
                  // Headers with markdown formatting
                  if (line.startsWith('# ')) {
                    const headerText = line.substring(2)
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
                    return `<h1 class="text-3xl font-bold mt-6 mb-2 text-gray-900">${headerText}</h1>`
                  }
                  if (line.startsWith('## ')) {
                    const headerText = line.substring(3)
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
                    return `<h2 class="text-2xl font-bold mt-5 mb-2 text-gray-900">${headerText}</h2>`
                  }
                  if (line.startsWith('### ')) {
                    const headerText = line.substring(4)
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
                    return `<h3 class="text-xl font-bold mt-4 mb-1 text-gray-900">${headerText}</h3>`
                  }
                  if (line.startsWith('#### ')) {
                    const headerText = line.substring(5)
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
                    return `<h4 class="text-lg font-semibold mt-3 mb-1 text-gray-900">${headerText}</h4>`
                  }

                  // List items
                  if (line.startsWith('- ')) {
                    const content = line.substring(2)
                    // Apply bold formatting to the content
                    const formattedContent = content
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
                      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800">$1</code>')
                      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-orange-500 hover:text-orange-600 underline font-medium">$1</a>')

                    // Check if it's a colon-separated item (like "Term: Description")
                    if (content.includes(': ')) {
                      const [term, description] = content.split(': ', 2)
                      const formattedTerm = term.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                      const formattedDesc = description.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
                      return `<li class="ml-4 mb-1">${formattedTerm}: ${formattedDesc}</li>`
                    }
                    return `<li class="ml-4 mb-1">${formattedContent}</li>`
                  }
                  if (/^\d+\.\s/.test(line)) {
                    const content = line.replace(/^\d+\.\s/, '')
                    // Apply bold formatting to the content
                    const formattedContent = content
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
                      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800">$1</code>')
                      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-orange-500 hover:text-orange-600 underline font-medium">$1</a>')

                    // Check if it's a colon-separated item
                    if (content.includes(': ')) {
                      const [term, description] = content.split(': ', 2)
                      const formattedTerm = term.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                      const formattedDesc = description.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
                      return `<li class="ml-4 mb-1">${formattedTerm}: ${formattedDesc}</li>`
                    }
                    return `<li class="ml-4 mb-1">${formattedContent}</li>`
                  }

                  // Empty lines become paragraph breaks
                  if (line.trim() === '') {
                    return '<br/>'
                  }

                  // Regular paragraphs with formatting
                  return `<p class="mb-3 leading-relaxed text-gray-700">${line
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
                    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800">$1</code>')
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-orange-500 hover:text-orange-600 underline font-medium">$1</a>')
                  }</p>`
                })
                .join('')
                // Group consecutive list items into proper lists
                .replace(/(<li class="ml-4 mb-1">.*?<\/li>\n?)+/g, (match) => {
                  // Check if this appears to be a numbered list by looking for numbered patterns
                  const hasNumberedContent = /\*\*Sign up\*\*|\*\*Upload|\*\*Choose|\*\*Wait|\*\*Review|\*\*Download|\*\*Create|Resolution.*1000x1000|Format.*JPG|Orientation.*portrait/i.test(match)
                  if (hasNumberedContent) {
                    return '<ol class="list-decimal ml-6 my-2 space-y-1">' + match + '</ol>'
                  } else {
                    return '<ul class="list-disc ml-6 my-2 space-y-1">' + match + '</ul>'
                  }
                })
                // Clean up extra br tags
                .replace(/(<br\/>\s*)+/g, '<br/>')
                // Remove br tags at the beginning
                .replace(/^(<br\/>\s*)+/, '')
            }}
          />
        ) : (
          <p>Content coming soon...</p>
        )}
      </div>

      {/* Call to Action */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 my-8">
        <h3 className="text-2xl font-bold mb-4">Ready to Create Your Own Coloring Pages?</h3>
        <p className="mb-4 text-gray-700">
          Transform your photos into beautiful, printable coloring pages with our AI-powered tool.
          Join thousands of users creating personalized art from their memories.
        </p>
        <Link
          href="/create"
          className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          Start Creating Free
        </Link>
      </div>

      {/* Article Footer */}
      <footer className="border-t pt-8 mt-12">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Published on {format(new Date(post.date), 'MMMM d, yyyy')}
          </div>
          <Link
            href="/blog"
            className="text-orange-500 hover:text-orange-600 font-medium"
          >
            ← Back to Blog
          </Link>
        </div>
      </footer>
    </article>
  )
}
