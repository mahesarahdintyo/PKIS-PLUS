"use client";

import React from "react";
import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";

const MACHINE_CARDS = [
  { slug: "tandem", label: "Tandem", hint: "PA-1 s/d PA-10", icon: "⚙️" },
  { slug: "blanking", label: "Blanking", hint: "Blanking 500t", icon: "⚙️" },
  { slug: "transfer-2000t", label: "Transfer 2000t", hint: "PT-1", icon: "⚙️" },
  { slug: "transfer-800t", label: "Transfer 800t", hint: "PT-2", icon: "⚙️" },
  { slug: "pc200t", label: "PC200t", hint: "PC-1, PC-2", icon: "⚙️" },
];

export default function InputProduksiPage() {
  return (
    <HeaderNav activeTitle="Input Produksi">
      <div className="page-header">
        <h1 className="page-title">
          <span className="eyebrow">Input</span>
          Pilih Line Produksi
        </h1>
      </div>

      <div className="machine-cards-grid">
        {MACHINE_CARDS.map((m) => (
          <Link key={m.slug} href={`/machines/${m.slug}`} className="machine-card card-glow-info">
            <div className="machine-card-top">
              <span className="machine-card-name">{m.label}</span>
              <span style={{ fontSize: 22 }}>{m.icon}</span>
            </div>
            <div className="hint">{m.hint}</div>
          </Link>
        ))}
      </div>
    </HeaderNav>
  );
}
