import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const dokployDeployUrl = process.env.DOKPLOY_DEPLOY_URL;
const fallbackDeployUrl = dokployDeployUrl
  ? /^https?:\/\//.test(dokployDeployUrl)
    ? dokployDeployUrl
    : `https://${dokployDeployUrl}`
  : undefined;

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || fallbackDeployUrl || "http://localhost:3000";
const appTitle = "Open Meet";
const appDescription =
  "Privacy-first meeting transcription and AI summaries that run locally in your browser.";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${appTitle} - Private Meeting Notes`,
    template: `%s | ${appTitle}`,
  },
  description: appDescription,
  applicationName: appTitle,
  keywords: [
    "meeting transcription",
    "ai meeting summary",
    "private notes",
    "local-first",
    "speech to text",
    "browser ai",
  ],
  authors: [{ name: "Open Meet" }],
  creator: "Open Meet",
  publisher: "Open Meet",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: appTitle,
    title: `${appTitle} - Private Meeting Notes`,
    description: appDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Open Meet app preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${appTitle} - Private Meeting Notes`,
    description: appDescription,
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    shortcut: "/icon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <Script
          src="https://melon-husk-deployments-umami-98cd2a-152-67-3-182.ujwalbhagat.com/script.js"
          data-website-id="cb785ee5-8fb2-457a-ba74-8da9883a6435"
          data-domains="meet.ujwalbhagat.com"
          data-do-not-track="true"
          data-performance="true"
          data-exclude-search="true"
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  );
}
