import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./workspace-ui.css";
export const metadata: Metadata = {
  title: "Jotstead",
  description:
    "A home for your ideas. Your personal workspace for notes, projects, and databases.",
  applicationName: "Jotstead",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/favicon-32.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Jotstead" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#191b1c" },
  ],
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
