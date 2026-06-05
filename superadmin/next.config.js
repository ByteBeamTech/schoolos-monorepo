/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },

  // ✅ Ismein @schoolos/trpc add kar diya
  transpilePackages: ['@schoolos/api-contracts', '@schoolos/trpc'],
};

module.exports = nextConfig;
