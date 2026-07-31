import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobNest | Profesionales confiables para cada proyecto",
  description: "Marketplace premium para encontrar, comparar y contratar profesionales con confianza visible."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
