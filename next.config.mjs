/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'export',
  images: {
    unoptimized: true,
    formats: ['image/webp', 'image/avif'],
    domains: ['storyincolor.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'storyincolor.com',
        pathname: '**',
      },
    ],
  },
  // These are crucial for proper path resolution with a custom domain
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
}

// The most important part - ensure all asset paths work correctly
const isGithubActions = process.env.GITHUB_ACTIONS || false

if (isGithubActions) {
  console.log('🔧 Building for GitHub Pages with custom domain')
  // For GitHub Pages with custom domain, keep paths absolute
  nextConfig.basePath = ''
  // Don't use a trailing slash for asset prefix
  nextConfig.assetPrefix = ''
} else {
  console.log('🔧 Building for local development')
  // For local development
  nextConfig.basePath = ''
  nextConfig.assetPrefix = ''
}

export default nextConfig