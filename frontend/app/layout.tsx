import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Palate - Restaurant Recommendations",
  description: "Vercel frontend powered by Streamlit API endpoints."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
