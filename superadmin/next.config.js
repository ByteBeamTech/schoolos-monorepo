/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },

  transpilePackages: ['@schoolos/api-contracts'],
};

module.exports = nextConfig;
