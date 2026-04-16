import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browski Consulting",
  description: "Money Print ORB subscription site",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}