import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "./language";
export const metadata: Metadata = {
  title: "MoneyFlow — Your money, in perspective",
  description:
    "Personal finance, thoughtfully organized. Track accounts, spending, budgets and goals.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
