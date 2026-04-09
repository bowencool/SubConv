const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/sub", destination: "/api/sub" },
      { source: "/provider", destination: "/api/provider" },
      { source: "/proxy", destination: "/api/proxy" },
    ];
  },
};

export default nextConfig;
