/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@mcpanel/shared'],
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
  },
};

export default nextConfig;
