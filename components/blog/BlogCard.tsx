import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface BlogPost {
  title: string
  description: string
  date: string
  author: string
  tags: string[]
  featured?: boolean
  readTime?: number
  url: string
  image?: string
}

interface BlogCardProps {
  post: BlogPost
  featured?: boolean
}

export function BlogCard({ post, featured = false }: BlogCardProps) {
  return (
    <Card className={`hover:shadow-lg transition-shadow ${featured ? 'border-orange-200' : ''}`}>
      <CardHeader>
        {post.image && (
          <div className="aspect-video overflow-hidden rounded-t-lg">
            <img
              src={post.image}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {post.tags?.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <CardTitle className={featured ? 'text-xl' : 'text-lg'}>
            <Link href={post.url} className="hover:text-orange-500">
              {post.title}
            </Link>
          </CardTitle>
          <CardDescription>{post.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{post.author}</span>
          <span>{format(new Date(post.date), 'MMM d, yyyy')}</span>
          {post.readTime && <span>{post.readTime} min read</span>}
        </div>
      </CardContent>
    </Card>
  )
}
