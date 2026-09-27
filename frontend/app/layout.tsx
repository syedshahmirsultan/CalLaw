import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: "CalLaw | California law, explained for you",
  description:
    "Describe your situation in plain words. CalLaw asks what it needs to know, then shows you the California laws that apply, quoted from the official text.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F6F1" },
    { media: "(prefers-color-scheme: dark)", color: "#0A101D" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const body = (
    // The theme script sets the `dark` class before hydration, hence suppressHydrationWarning.
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased min-h-screen flex flex-col font-sans">{children}</body>
    </html>
  );

  return clerkKey ? (
    <ClerkProvider
      publishableKey={clerkKey}
      appearance={{
        layout: { unsafe_disableDevelopmentModeWarnings: true },
        variables: { colorPrimary: "#0E1728", borderRadius: "0.9rem", fontFamily: "var(--font-inter)" },
      }}
    >
      {body}
    </ClerkProvider>
  ) : body;
}
