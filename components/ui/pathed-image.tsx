"use client"

import Image from 'next/image'
import { usePathname } from 'next/navigation'

interface PathImgProps {
  src: string
  alt?: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  [key: string]: any // For additional props
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
  priority = false,
  ...props
}: PathImgProps) {
  // Determine if this is likely an above-the-fold image that should be eager loaded
  const isAboveTheFold = priority || 
                         src.includes('best-6') || 
                         src.includes('hero') || 
                         src.includes('dog-coloring-hero');
  
  return (
    <Image
      src={src}
      alt={alt || ""}
      width={width}
      height={height}
      className={className}
      loading={isAboveTheFold ? "eager" : "lazy"}
      priority={isAboveTheFold}
      quality={80}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      {...props}
    />
  );
} 