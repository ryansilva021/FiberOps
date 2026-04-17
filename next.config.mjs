/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Node.js-only packages from being bundled by webpack.
  serverExternalPackages: ['ssh2', 'node-cron', 'web-push'],
};

export default nextConfig;
