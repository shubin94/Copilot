import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useLocation } from "wouter";
import { DetectiveApplicationForm } from "@/components/forms/detective-application-form";

export default function DetectiveSignup() {
  const [, setLocation] = useLocation();

  const handleSuccess = () => {
    setLocation("/application-under-review");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
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
