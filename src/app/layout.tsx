import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import { ToastProvider } from "@/ui/toast";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
// A fonte da logo smartclin: marca e títulos.
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "smartclin — gestão para clínicas", template: "%s · smartclin" },
  description: "Agenda, pacientes e equipe da sua clínica num só lugar.",
  applicationName: "smartclin",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#eef4fb", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${poppins.variable} h-full`}>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
