import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO title="About AskDetectives" description="Learn more about AskDetectives, the dedicated platform for discovering and connecting with professional private investigators." />
      <Navbar />
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
        <h1 className="text-4xl font-bold font-heading mb-6">About AskDetectives</h1>
        <div className="prose max-w-none text-gray-600">
          <p className="mb-4 text-lg">
            AskDetectives was created to bring structure, transparency, and trust to the private investigation industry. Finding a reliable private investigator can often feel uncertain, unverified, and confusing. AskDetectives simplifies this process by providing a dedicated platform where individuals and businesses can discover, evaluate, and connect with professional detectives across different locations.
          </p>
          <p className="mb-4">
            Our mission is to make the search for investigative services easier, safer, and more informed. We focus on verified profiles, clear service categories, and location-based discovery so users can find the right investigator based on their specific needs. Whether it involves background checks, corporate investigations, surveillance, cyber investigations, or personal matters, AskDetectives aims to streamline access to trusted professionals.
          </p>
          <p className="mb-4">
            We believe that privacy, discretion, and credibility are essential in this industry. That's why the platform is built with a focus on structured listings, transparent information, and user-friendly search functionality. Instead of relying on scattered online searches, users can access organized detective profiles in one place.
          </p>
          <p className="mb-4">
            AskDetectives is not just a directory — it is a growing ecosystem designed to modernize how investigative services are discovered and accessed. By combining technology with professionalism, we aim to create a trusted digital gateway for private investigation services.
          </p>
          <p className="mb-4 text-lg font-semibold text-gray-900">
            Our goal is simple: make finding the right detective straightforward, reliable, and efficient.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
