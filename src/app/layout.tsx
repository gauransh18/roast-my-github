import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Roast My GitHub",
  description: "Get a savage, AI-generated roast of any GitHub profile.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-background max-w-2xl mx-auto py-12 sm:py-24 px-6`}>
        {children}
      </body>
    </html>
  );
}
