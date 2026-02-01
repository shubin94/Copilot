import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useCurrency } from "@/lib/currency-context";

export default function PackagesPage() {
  const { formatPrice } = useCurrency();
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO title="Pricing & Packages" description="Choose the right plan for your detective agency." />
      <Navbar />
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold font-heading mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Start for free and upgrade as you grow. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Free Plan */}
          <div className="border border-gray-200 rounded-2xl p-8 flex flex-col">
            <h3 className="text-2xl font-bold mb-2">Free</h3>
            <p className="text-gray-500 mb-6">For new detectives just starting out.</p>
            <div className="text-4xl font-bold mb-6">{formatPrice(0)}<span className="text-lg text-gray-500 font-normal">/mo</span></div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> Basic Profile</li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> 1 Service Listing</li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> Standard Support</li>
            </ul>
            <Link href="/detective-signup">
              <Button variant="outline" className="w-full">Get Started</Button>
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="border-2 border-green-500 rounded-2xl p-8 flex flex-col relative shadow-lg">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-bold">
              Most Popular
            </div>
            <h3 className="text-2xl font-bold mb-2">Pro</h3>
            <p className="text-gray-500 mb-6">For professional investigators growing their business.</p>
            <div className="text-4xl font-bold mb-6">{formatPrice(49)}<span className="text-lg text-gray-500 font-normal">/mo</span></div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> Verified Badge</li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> Unlimited Service Listings</li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> Priority Support</li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> Analytics Dashboard</li>
            </ul>
            <Link href="/detective-signup">
              <Button className="w-full bg-green-600 hover:bg-green-700">Start Pro Trial</Button>
            </Link>
          </div>

          {/* Agency Plan */}
          <div className="border border-gray-200 rounded-2xl p-8 flex flex-col">
            <h3 className="text-2xl font-bold mb-2">Agency</h3>
            <p className="text-gray-500 mb-6">For established agencies with multiple agents.</p>
            <div className="text-4xl font-bold mb-6">{formatPrice(199)}<span className="text-lg text-gray-500 font-normal">/mo</span></div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> Everything in Pro</li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> Multiple Team Members</li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> API Access</li>
              <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> Dedicated Account Manager</li>
            </ul>
            <Link href="/contact">
              <Button variant="outline" className="w-full">Contact Sales</Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
