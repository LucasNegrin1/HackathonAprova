"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// O widget (iframe) e o site de exemplo não mostram a navegação interna.
export default function Nav() {
  const caminho = usePathname();
  if (caminho.startsWith("/widget") || caminho.startsWith("/site")) return null;
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
        <span className="font-semibold">
          Aprova <span className="text-emerald-600">Triagem</span>
        </span>
        <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">Simulador WhatsApp</Link>
        <Link href="/site" className="text-sm text-slate-600 hover:text-slate-900">Bot no site</Link>
        <Link href="/painel" className="text-sm text-slate-600 hover:text-slate-900">Triagem</Link>
        <Link href="/gestao" className="text-sm text-slate-600 hover:text-slate-900">Gestão (PrefTech)</Link>
      </nav>
    </header>
  );
}
