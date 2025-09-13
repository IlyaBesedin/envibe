// Ensure Next resolves ESM builds of node modules where available
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: true,
  },
  // Transpile these to ensure consistent ESM handling across server/client
  transpilePackages: [
    '@stackframe/js',
    '@stackframe/stack-shared',
    'oauth4webapi',
  ],
};

export default nextConfig;

