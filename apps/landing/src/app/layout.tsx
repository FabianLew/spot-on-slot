import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Spot On Slot — artyści i lokale w jednym miejscu",
  description:
    "Platforma, która łączy artystów, bookerów i lokale. Sprawdź dostępność, umów występ i zorganizuj udane wydarzenie bez stresu.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
