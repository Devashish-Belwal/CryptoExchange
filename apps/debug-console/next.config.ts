import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  async rewrites() {
    return [
      {
        source: "/core/api/v1/:path*",
        destination: "http://localhost:8080/api/v1/:path*",
      },
      {
        source: "/engine/:path*",
        destination: "http://localhost:8081/:path*",
      },
      {
        source: "/database/:path*",
        destination: "http://localhost:8082/:path*",
      },
      {
        source: "/ws/:path*",
        destination: "http://localhost:8083/:path*",
      },
      {
        source: "/poller/:path*",
        destination: "http://localhost:8084/:path*",
      },
      {
        source: "/proxy/:path*",
        destination: "http://localhost:8085/:path*",
      },
    ]
  },
}

export default nextConfig
