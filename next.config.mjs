/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Reduces lucide-react barrel / HMR issues (e.g. stale icon chunks after removing imports)
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    /** Cache optimized proxy responses longer (Supabase origin still sends its own Cache-Control). */
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "olidrzdufyewiocquhtb.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
