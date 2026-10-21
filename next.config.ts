import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Public profiles live at /@handle (the link for an Instagram bio).
      // App Router folders can't start with "@" (that's a parallel route), so
      // the page is app/u/[handle] and this maps the pretty URL onto it.
      { source: "/@:handle", destination: "/u/:handle" },
    ];
  },
};

export default nextConfig;
