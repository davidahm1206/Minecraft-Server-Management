/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  transpilePackages: ['@mcpanel/shared'],
  images: {
    unoptimized: true, // required for static export
  },
};

export default nextConfig;
