import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable SharedArrayBuffer for ONNX Runtime WASM multi-threading
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  turbopack: {
    resolveAlias: {
      "sharp$": { path: "" },
      "onnxruntime-node$": { path: "" },
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default nextConfig;
