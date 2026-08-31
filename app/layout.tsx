import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "notari — hackathon submissions, provably timestamped",
    template: "%s · notari",
  },
  description:
    "Immutable, publicly verifiable records of hackathon submissions on Soroban, with an advisory AI layer that flags likely cross-event resubmissions before judging.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Set data-theme before first paint — no light/dark flash. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`try { document.documentElement.setAttribute('data-theme', localStorage.getItem('notari-theme') === 'light' ? 'light' : 'dark'); } catch (e) { document.documentElement.setAttribute('data-theme', 'dark'); }`}
        </Script>
        <ThemeProvider>
          <AuthProvider>
            <Header />

            <main className="flex-1">{children}</main>
          </AuthProvider>
        </ThemeProvider>

        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              Exact-duplicate rejection is enforced on-chain and cannot be
              overridden. Similarity flags are advisory — an organizer decides.
            </p>
            <p className="mono">testnet only · never mainnet</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
