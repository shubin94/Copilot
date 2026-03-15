import React from "react";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 container mx-auto px-6 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
