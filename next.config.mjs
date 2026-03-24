import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reactNativeShim = path.resolve(__dirname, "lib/shims/react-native.js");

/**
 * Expo SDK packages (expo-notifications → expo-modules-core) ship TypeScript sources as the
 * package entry; Turbopack cannot bundle them reliably. Use `next dev --webpack` / `next build --webpack`
 * (see package.json scripts). Turbopack aliases below remain for tooling that still resolves them.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "expo",
    "expo-modules-core",
    "expo-notifications",
    "expo-device",
    "expo-constants",
    "expo-keep-awake",
    "react-native-web",
  ],
  turbopack: {
    resolveAlias: {
      "react-native": "./lib/shims/react-native.js",
    },
  },
  webpack: (config, { webpack: webpackApi }) => {
    config.resolve = config.resolve ?? {};
    const alias = config.resolve.alias;
    if (Array.isArray(alias)) {
      alias.push({ name: "react-native", alias: reactNativeShim });
    } else {
      config.resolve.alias = {
        ...(alias || {}),
        "react-native": reactNativeShim,
      };
    }

    config.plugins.push(
      new webpackApi.NormalModuleReplacementPlugin(/^react-native$/, reactNativeShim)
    );
    return config;
  },
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
