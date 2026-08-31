"use client";

import Link from "next/link";
import { useState } from "react";
import Logo from "@/components/Logo";
import { AuthChip } from "@/components/auth/AuthProvider";
import { ThemeToggle } from "@/components/ThemeProvider";

const nav = [
  { href: "/submit", label: "Submit" },
  { href: "/register", label: "Register event" },
  { href: "/dashboard", label: "Organizers" },
  { href: "/verify", label: "Verify" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="text-lg font-semibold tracking-tight">notari</span>
          <span className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted sm:inline">
            Soroban testnet
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-muted md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <ThemeToggle />
          <AuthChip />
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <AuthChip />
          <button
            className="btn btn-ghost px-2 py-1 text-sm"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-line px-4 py-3 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm text-muted"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
