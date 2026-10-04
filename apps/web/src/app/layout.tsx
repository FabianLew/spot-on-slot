import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Spot On Slot",
  description: "Umawiaj występy i wydarzenia bez stresu.",
};

export const viewport: Viewport = {
  themeColor: "#5b3df5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
