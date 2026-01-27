import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO title="Terms of Service" description="The terms and conditions for using FindDetectives." />
      <Navbar />
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
        <h1 className="text-4xl font-bold font-heading mb-6">Terms of Service</h1>
        <div className="prose max-w-none text-gray-600">
          <p className="mb-4">Last updated: November 21, 2025</p>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
          <p className="mb-4">
            By accessing or using our website, you agree to be bound by these Terms of Service and all applicable laws and regulations.
          </p>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Use License</h2>
          <p className="mb-4">
            Permission is granted to temporarily download one copy of the materials (information or software) on FindDetectives' website for personal, non-commercial transitory viewing only.
          </p>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Disclaimer</h2>
          <p className="mb-4">
            The materials on FindDetectives' website are provided on an 'as is' basis. FindDetectives makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
