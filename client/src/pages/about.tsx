import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO title="About Us" description="Learn more about FindDetectives, the leading marketplace for professional private investigators." />
      <Navbar />
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
        <h1 className="text-4xl font-bold font-heading mb-6">About Us</h1>
        <div className="prose max-w-none text-gray-600">
          <p className="mb-4 text-lg">
            FindDetectives is the world's most trusted marketplace for connecting individuals and businesses with verified private investigators.
          </p>
          <p className="mb-4">
            Our mission is to bring transparency, trust, and professionalism to the private investigation industry. We verify every detective on our platform to ensure you get the highest quality service.
          </p>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Our Story</h2>
          <p className="mb-4">
            Founded in 2025, we saw a need for a safe, secure way to hire private investigators. The traditional market was fragmented and opaque. We built FindDetectives to change that.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
