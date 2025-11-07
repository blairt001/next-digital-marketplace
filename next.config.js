/** @type {import('next').NextConfig} */
const PUBLIC_HOST = process.env.NEXT_PUBLIC_SERVER_URL
  ? new URL(process.env.NEXT_PUBLIC_SERVER_URL).hostname
  : null;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "localhost",
        pathname: "/**",
        port: "3000",
        protocol: "http",
      },
    ],
  },
};

module.exports = nextConfig;
