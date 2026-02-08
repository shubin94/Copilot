import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useLocation } from "wouter";
import { DetectiveApplicationForm } from "@/components/forms/detective-application-form";
import { SEO } from "@/components/seo";

export default function DetectiveSignup() {
  const [, setLocation] = useLocation();

  const handleSuccess = () => {
    setLocation("/application-under-review");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <SEO 
        title="Become a Detective | FindDetectives"
        description="Apply to join FindDetectives as a professional private investigator. Show your expertise and connect with clients."
        robots="noindex, follow"
      />
      <Navbar />
      
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
        <div className="max-w-3xl mx-auto">
          <DetectiveApplicationForm mode="public" onSuccess={handleSuccess} />
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
