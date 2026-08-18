import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["200", "400", "600", "700"],
});

export const metadata: Metadata = {
  title: "BlastRadius — Supply Chain Blast Radius Visualizer",
  description:
    "When an npm package is compromised, BlastRadius shows you the complete transitive blast radius in seconds. Powered by HydraDB's graph-native engine.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="bg-black text-white min-h-screen">{children}</body>
    </html>
  );
}
