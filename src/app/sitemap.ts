import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/kontakt",
    "/registrieren",
    "/preise",
    "/anwendungsfaelle",
    ...["core", "flow", "academy", "assist", "insights"].map(
      (m) => `/module/${m}`,
    ),
  ].map((path) => ({
    url: `${process.env.APP_URL || "http://localhost:3000"}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: path ? 0.6 : 1,
  }));
}
