import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O indicador de desenvolvimento ficava em cima do botão do bot (canto inferior direito).
  // Erros de compilação e de execução continuam aparecendo.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
