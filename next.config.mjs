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
}

// Handle GitHub Pages deployment paths
const repo = 'StoryInColor'
const isGithubActions = process.env.GITHUB_ACTIONS || false

// For production with custom domain, don't use basePath
if (isGithubActions) {
  // Empty base path for deployment - will work for both custom domain and GitHub Pages
  nextConfig.basePath = ''
  nextConfig.assetPrefix = ''
} else {
  // For local development
  nextConfig.basePath = ''
  nextConfig.assetPrefix = ''
}

export default nextConfig
