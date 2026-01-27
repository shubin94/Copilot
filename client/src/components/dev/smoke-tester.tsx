import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";

type Result = { name: string; ok: boolean; detail?: string };

export function SmokeTester() {
  const searchParams = new URLSearchParams(window.location.search);
  const enabled = searchParams.get("smoke") === "1" || searchParams.get("smoke") === "true";
  const [, setLocation] = useLocation();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    if (!enabled || running) return;
    setRunning(true);
    (async () => {
      const add = (r: Result) => setResults((prev) => [...prev, r]);

      try {
        setLocation("/");
        await new Promise((res) => setTimeout(res, 500));
        const nav = document.querySelector("nav");
        add({ name: "Home Navbar", ok: !!nav });
      } catch (e: any) {
        add({ name: "Home Navbar", ok: false, detail: String(e?.message || e) });
      }

      try {
        const res = await api.services.search({ limit: 1, sortBy: "popular" });
        const svc = Array.isArray((res as any)?.services) ? (res as any).services[0] : null;
        if (svc?.id) {
          setLocation(`/service/${svc.id}`);
          await new Promise((res2) => setTimeout(res2, 800));
          const title = document.querySelector('[data-testid="text-service-title"]');
          add({ name: "Service Page", ok: !!title });
          const contactEmail = document.querySelector('[data-testid="button-contact-email"]');
          add({ name: "Service Contact Email", ok: !!contactEmail });
        } else {
          add({ name: "Service Page", ok: true, detail: "No services available" });
        }
      } catch (e: any) {
        add({ name: "Service Page", ok: false, detail: String(e?.message || e) });
      }

      try {
        const res = await api.detectives.search({ status: "active", limit: 1 });
        const det = Array.isArray((res as any)?.detectives) ? (res as any).detectives[0] : null;
        if (det?.id) {
          setLocation(`/p/${det.id}`);
          await new Promise((res2) => setTimeout(res2, 800));
          const name = document.querySelector('[data-testid="text-detective-name"]');
          add({ name: "Detective Page", ok: !!name });
          const ws = document.querySelector('a[href^="http"][target="_blank"]');
          add({ name: "Detective Website Link", ok: !!ws });
        } else {
          add({ name: "Detective Page", ok: true, detail: "No detectives available" });
        }
      } catch (e: any) {
        add({ name: "Detective Page", ok: false, detail: String(e?.message || e) });
      }

      try {
        setLocation("/search");
        await new Promise((res) => setTimeout(res, 600));
        const heading = document.querySelector('[data-testid="text-search-heading"]');
        add({ name: "Search Page", ok: !!heading });
        const filterBtn = document.querySelector('[data-testid="button-filter-mobile"]') || document.querySelector('[data-testid="button-sort-dropdown"]');
        add({ name: "Search Controls", ok: !!filterBtn });
      } catch (e: any) {
        add({ name: "Search Page", ok: false, detail: String(e?.message || e) });
      }

      try {
        setLocation("/user/favorites");
        await new Promise((res) => setTimeout(res, 600));
        const prompt = document.querySelector('[data-testid="button-logout"]') || document.querySelector('h1');
        add({ name: "Favorites Page", ok: !!prompt });
      } catch (e: any) {
        add({ name: "Favorites Page", ok: false, detail: String(e?.message || e) });
      }

      try {
        setLocation("/about");
        await new Promise((res) => setTimeout(res, 400));
        add({ name: "About Page", ok: !!document.querySelector("nav") });
        setLocation("/privacy");
        await new Promise((res) => setTimeout(res, 400));
        add({ name: "Privacy Page", ok: !!document.querySelector("nav") });
        setLocation("/terms");
        await new Promise((res) => setTimeout(res, 400));
        add({ name: "Terms Page", ok: !!document.querySelector("nav") });
        setLocation("/packages");
        await new Promise((res) => setTimeout(res, 400));
        add({ name: "Packages Page", ok: !!document.querySelector("nav") });
        setLocation("/blog");
        await new Promise((res) => setTimeout(res, 400));
        add({ name: "Blog Page", ok: !!document.querySelector("nav") });
        setLocation("/support");
        await new Promise((res) => setTimeout(res, 400));
        add({ name: "Support Page", ok: !!document.querySelector("nav") });
        setLocation("/contact");
        await new Promise((res) => setTimeout(res, 400));
        add({ name: "Contact Page", ok: !!document.querySelector("nav") });
      } catch (e: any) {
        add({ name: "Static Pages", ok: false, detail: String(e?.message || e) });
      }

      setRunning(false);
    })();
  }, [enabled, running, setLocation]);

  if (!enabled) return null;

  const total = results.length;
  const pass = results.filter((r) => r.ok).length;

  return (
    <div className="fixed top-24 right-6 z-[1000] bg-white border border-gray-200 rounded-lg shadow-xl w-80">
      <div className="p-3 border-b flex items-center justify-between">
        <span className="font-bold text-sm">Smoke Test</span>
        <span className="text-xs text-gray-600">{pass}/{total} passing</span>
      </div>
      <div className="max-h-72 overflow-auto">
        {results.map((r, i) => (
          <div key={i} className="px-3 py-2 text-sm flex items-center justify-between border-b">
            <span className="truncate pr-2">{r.name}</span>
            <span className={r.ok ? "text-green-600 font-bold" : "text-red-600 font-bold"}>{r.ok ? "OK" : "FAIL"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

