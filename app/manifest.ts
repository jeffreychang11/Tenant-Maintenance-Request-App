import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SimpleRoost",
    short_name: "SimpleRoost",
    description: "Submit and track home maintenance requests with your landlord.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      { src: "/pwa-icons/192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icons/512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/pwa-icons/512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
