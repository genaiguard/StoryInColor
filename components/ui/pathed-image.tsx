"use client"

import Image from 'next/image'
import { usePathname } from 'next/navigation'

interface PathImgProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  fill?: boolean
  priority?: boolean
  quality?: number
  sizes?: string
  onError?: (e: any) => void
}

/**
 * A wrapper around next/image that handles paths properly for GitHub Pages and custom domain deployment
 */
export function PathImg({
  src,
  alt,
  width,
  height,
  className,
  fill = false,
  priority = false,
  quality,
  sizes,
  onError,
  ...props
}: PathImgProps) {
  // Adjust the path for static images in public directory
  let adjustedSrc = src;
  
  // Only add the basePath for local public images that don't have a domain
  if (
    src && 
    src.startsWith('/') && 
    !src.startsWith('//') && 
    !src.startsWith('http')
  ) {
    // Check if we're on GitHub Pages (not custom domain)
    if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
      // For GitHub Pages, add the repo name prefix
      adjustedSrc = `/StoryInColor${src}`;
    } else {
      // For custom domain or local development, use the path as is
      adjustedSrc = src;
    }
  }
  
  // For Firebase storage or other external URLs, use as is
  return (
    <Image
      src={adjustedSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      fill={fill}
      priority={priority}
      quality={quality}
      sizes={sizes}
      onError={onError || ((e) => {
        // Default error handler - use basic placeholder path for both environments
        if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
          e.currentTarget.src = '/StoryInColor/placeholder.svg';
        } else {
          e.currentTarget.src = '/placeholder.svg';
        }
      })}
      {...props}
    />
  )
} 