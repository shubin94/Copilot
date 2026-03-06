import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";

export default function NewsHubPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO 
        title="Investigation News & Resources | AskDetectives" 
        description="Latest articles, investigation insights, and detective industry updates."
        canonical="https://www.askdetectives.com/news"
      />
      <Navbar />
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold font-heading mb-6">Investigation News & Resources</h1>
          <p className="text-xl text-gray-600 mb-12">
            Explore the latest articles, investigation insights, and updates from the detective industry.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <p className="text-gray-700 mb-4">
              Featured articles and case studies coming soon. Check back for the latest investigation news and detective industry insights.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
