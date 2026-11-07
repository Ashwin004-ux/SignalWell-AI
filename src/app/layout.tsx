import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  manifest: "/manifest.json",
  title: {
    default: "SignalWell AI | Digital Wellbeing & Mental Health Insights",
    template: "%s | SignalWell AI"
  },
  description:
    "SignalWell AI tracks browser usage, sleep, and mood together, and uses AI analysis to help you see how your digital habits and wellbeing relate.",
  openGraph: {
    title: "SignalWell AI",
    description:
      "Understand your digital habits. Understand your wellbeing.",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "SignalWell AI",
    description: "Understand your digital habits. Understand your wellbeing."
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${sourceSerif.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
