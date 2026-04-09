const isNitroDeployment = Boolean(process.env.NITRO_PRESET || process.env.VERCEL);

const nextConfig = {
  ...(isNitroDeployment ? {} : { output: "standalone" }),
  async rewrites() {
    return [
      { source: "/sub", destination: "/api/sub" },
      { source: "/provider", destination: "/api/provider" },
      { source: "/proxy", destination: "/api/proxy" },
    ];
  },
};

export default nextConfig;
