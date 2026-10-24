import type { Metadata } from "next";
import Script from "next/script";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

// Painel PrefTech. As fontes eram carregadas no index.html do Vite; aqui vêm do next/font.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-preftech-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-preftech-mono" });

export const metadata: Metadata = {
  title: "Visão Geral do Suporte — Painel Gerencial de Operações | PrefTech",
  description: "Painel Gerencial de Operações de Suporte - PrefTech. Identificação imediata de prioridades operacionais, SLAs e gargalos.",
  icons: { icon: "/favicon.svg" },
};

export default function PrefTechLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`preftech-root ${jakarta.variable} ${mono.variable}`}>
      {children}
      {/* Bot de atendimento: o usuário conversa e o bot abre o chamado, que entra na fila deste painel. */}
      <Script src="/widget.js" strategy="afterInteractive" />
    </div>
  );
}
