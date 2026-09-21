import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Email Router",
  description: "Route user messages to the right department with a local AI agent.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
