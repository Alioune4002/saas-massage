import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";

import { CookieConsentProvider } from "@/components/providers/cookie-consent-provider";
import { GlobalServiceBanner } from "@/components/layout/global-service-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { BackendStatusProvider } from "@/components/providers/backend-status-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: {
    default: "NUADYX",
    template: "%s | NUADYX",
  },
  description:
    "NUADYX, l’annuaire des praticiens du massage et du bien-être avec page praticien partageable et inscription gratuite pendant le lancement.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.jpg",
  },
  openGraph: {
    title: "NUADYX",
    description:
      "L’annuaire des praticiens du massage et du bien-être.",
    images: [
      {
        url: "/images/logo-dark.jpg",
        width: 673,
        height: 659,
        alt: "NUADYX",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NUADYX",
    description:
      "L’annuaire des praticiens du massage et du bien-être.",
    images: ["/images/logo-dark.jpg"],
  },
};

const themeInitScript = `
  (function() {
    try {
      var storedTheme = localStorage.getItem("nuadyx-theme");
      var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      var theme =
        storedTheme === "light" || storedTheme === "dark"
          ? storedTheme
          : (prefersDark ? "dark" : "light");
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.classList.toggle("light", theme === "light");
      document.documentElement.style.colorScheme = theme;
    } catch (error) {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] font-sans">
        <ThemeProvider>
          <BackendStatusProvider>
            <CookieConsentProvider>
              <div className="flex min-h-screen flex-col">
                <GlobalServiceBanner />
                <div className="flex-1">{children}</div>
                <SiteFooter />
              </div>
            </CookieConsentProvider>
          </BackendStatusProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
