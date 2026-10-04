import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spot On Slot",
    short_name: "SOS",
    description: "Umawiaj występy i wydarzenia bez stresu.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#5b3df5",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
