import path from "node:path";
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const csp: Record<string, string[]> = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "object-src": ["'none'"],
  "img-src": ["'self'", "data:", "https:"],
  "font-src": ["'self'", "data:"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "script-src": ["'self'", "'unsafe-inline'"],
  "connect-src": ["'self'", "https://api.lapwise.dev", "https://lapwise.dev"],
};

// Next.js requires 'unsafe-eval' in development for Fast Refresh (HMR) and source maps.
if (!isProd) {
  csp["script-src"].push("'unsafe-eval'");
  csp["connect-src"].push(
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "ws://localhost:3000",
    "ws://127.0.0.1:3000",
  );
}

const contentSecurityPolicy = Object.entries(csp)
  .map(([key, values]) => `${key} ${values.join(" ")}`)
  .join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.formula1.com",
        pathname: "/content/dam/fom-website/**",
      },
      {
        protocol: "https",
        hostname: "media.formula1.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
