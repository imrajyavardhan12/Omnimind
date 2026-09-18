/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship raw TypeScript (exports map points at src).
  transpilePackages: ['@omnimind/types', '@omnimind/config'],
  webpack: (config) => {
    // Shared packages use TypeScript ESM-style relative imports (`./x.js`
    // for `./x.ts`). Teach webpack TypeScript's own resolution for them.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.jsx': ['.tsx', '.jsx'],
      ...config.resolve.extensionAlias,
    }
    return config
  },
};

module.exports = nextConfig;