import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reactNativeShim = path.resolve(__dirname, "lib/shims/react-native.js");

/** Supabase Storage public URLs — hostname comes from env (no hardcoded project ref). */
function supabaseStorageRemotePattern() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    const hostname = new URL(raw).hostname;
    if (!hostname) return null;
    return {
      protocol: "https",
      hostname,
      pathname: "/storage/v1/object/public/**",
    };
  } catch {
    return null;
  }
}

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
    "leaflet",
    "react-leaflet",
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
    /** Larger multipart bodies for server actions (e.g. profile photo uploads). Must live under `experimental` in Next 16 — top-level `serverActions` is not applied. Default is 1 MB. */
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    /** Cache optimized `/_next/image` derivatives (reduces repeat work on mobile revisits). */
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: (() => {
      const storagePattern = supabaseStorageRemotePattern();
      /** Google OAuth profile images (`lh3.googleusercontent.com`, etc.) — required for `next/image` on admin + avatars. */
      const googleAvatarPatterns = [
        "lh3.googleusercontent.com",
        "lh4.googleusercontent.com",
        "lh5.googleusercontent.com",
        "lh6.googleusercontent.com",
      ].map((hostname) => ({
        protocol: "https",
        hostname,
        pathname: "/**",
      }));
      return [...(storagePattern ? [storagePattern] : []), ...googleAvatarPatterns];
    })(),
  },
};

export default nextConfig;
