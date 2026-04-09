import { defineConfig } from "vite";
import vinext from "vinext";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { nitro } from "nitro/vite";

const isCloudflare = process.env.DEPLOY_TARGET === "cloudflare";
const isNitro = Boolean(process.env.NITRO_PRESET || process.env.VERCEL);

export default defineConfig({
  plugins: [
    vinext(),
    tailwindcss(),
    ...(isCloudflare
      ? [
          cloudflare({
            viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
          }),
        ]
      : []),
    ...(isNitro ? [nitro()] : []),
  ],
  resolve: {
    alias: [
      { find: /^next\/navigation$/, replacement: "vinext/shims/navigation" },
      { find: /^next\/server$/, replacement: "vinext/shims/server" },
      { find: /^next\/headers$/, replacement: "vinext/shims/headers" },
      { find: /^next\/link$/, replacement: "vinext/shims/link" },
      { find: /^next\/image$/, replacement: "vinext/shims/image" },
      { find: /^next\/script$/, replacement: "vinext/shims/script" },
      { find: /^next\/cache$/, replacement: "vinext/shims/cache" },
      { find: /^next\/dynamic$/, replacement: "vinext/shims/dynamic" },
      { find: /^next\/router$/, replacement: "vinext/shims/router" },
      { find: /^next\/head$/, replacement: "vinext/shims/head" },
      { find: /^next\/og$/, replacement: "vinext/shims/og" },
      { find: /^next\/form$/, replacement: "vinext/shims/form" },
      { find: /^next\/config$/, replacement: "vinext/shims/config" },
      { find: /^next\/constants$/, replacement: "vinext/shims/constants" },
      { find: /^next\/font\/google$/, replacement: "vinext/shims/font-google" },
      { find: /^next\/font\/local$/, replacement: "vinext/shims/font-local" },
      { find: /^next\/compat\/router$/, replacement: "vinext/shims/compat-router" },
      { find: /^next\/error$/, replacement: "vinext/shims/error" },
      { find: /^next\/amp$/, replacement: "vinext/shims/amp" },
      { find: /^next\/web-vitals$/, replacement: "vinext/shims/web-vitals" },
      { find: /^next$/, replacement: "vinext/shims/app" },
    ],
  },
});
