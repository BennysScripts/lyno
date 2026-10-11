import type { Metadata } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/dm-sans";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "LYNO — Klarheit für die Arbeit, die zählt.",
    template: "%s · LYNO",
  },
  description:
    "Prozesse, Wissen und Zusammenarbeit in einem Arbeitsraum. LYNO für deutsche IT-Dienstleister und Agenturen.",
  openGraph: {
    title: "LYNO — Gemeinsam klarer arbeiten.",
    description:
      "Der gemeinsame Arbeitsraum für Prozesse, Wissen und Zusammenarbeit.",
    type: "website",
    locale: "de_DE",
  },
  robots: { index: true, follow: true },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem('lyno-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{}`,
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Zum Inhalt springen
        </a>
        {children}
      </body>
    </html>
  );
}
