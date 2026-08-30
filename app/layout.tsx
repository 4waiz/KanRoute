import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { Shell } from "@/components/Shell";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KanRoute - Fewer vans. Same deliveries.",
  description:
    "KanRoute consolidates Dubai last-mile deliveries. Context.dev reads real supplier receiving hours, Convex holds live state, Devin builds and proves the routing plan.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ConvexClientProvider>
          <Shell>{children}</Shell>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
