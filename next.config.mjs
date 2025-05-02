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

// Handle GitHub Pages deployment paths
const isGithubActions = process.env.GITHUB_ACTIONS || false

// For deployment with custom domain, ensure paths are correctly set
if (isGithubActions) {
  // When running in GitHub Actions, use absolute URLs for assets
  nextConfig.basePath = ''
  // This is critical - it ensures resources are loaded from the domain root
  nextConfig.assetPrefix = '/'
} else {
  // For local development
  nextConfig.basePath = ''
  nextConfig.assetPrefix = ''
}

export default nextConfig
