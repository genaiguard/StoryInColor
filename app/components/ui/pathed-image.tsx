import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';

// Component that displays an image from a path with fallback handling
export function PathImg({ 
  src, 
  alt, 
  onError,
  ...props 
}: ImageProps & { 
  onError?: () => void; 
}) {
  const [error, setError] = useState(false);
  
  // Use placeholder image if error occurs
  const imgSrc = error ? '/placeholder-image.jpg' : src;
  
  // Handle image errors including CORS errors
  const handleError = () => {
    console.warn(`Image error loading: ${src}`);
    setError(true);
    if (onError) onError();
  };
  
  // Check if the URL is from Firebase Storage
  const isFirebaseStorageUrl = typeof src === 'string' && (
    src.includes('firebasestorage.googleapis.com') || 
    src.includes('token=cors-bypass')
  );
  
  // For Firebase Storage URLs, use a direct img tag to avoid Next.js image optimization
  if (isFirebaseStorageUrl) {
    return (
      <img
        src={imgSrc.toString()}
        alt={alt || 'Image'}
        style={{ 
          maxWidth: '100%', 
          height: 'auto',
          objectFit: props.objectFit as any || 'cover',
          ...(props.fill ? { 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          } : {}),
          ...props.style 
        }}
        onError={handleError}
        crossOrigin="anonymous"
      />
    );
  }
  
  // For other URLs, use Next.js Image component
  return (
    <Image
      src={imgSrc}
      alt={alt || 'Image'}
      {...props}
      onError={handleError}
    />
  );
} 