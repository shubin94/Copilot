import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  {
    question: "How do I hire a detective?",
    answer: "Simply browse our search page, filter by your needs, and click 'Contact' or 'Hire' on a detective's profile."
  },
  {
    question: "Is my information kept private?",
    answer: "Yes, we take privacy very seriously. All communications are secure and we do not share your personal details without consent."
  },
  {
    question: "How are detectives verified?",
    answer: "We conduct manual reviews of licenses, insurance, and background checks for all 'Verified' and 'Agency' tier detectives."
  },
  {
    question: "What if I'm not satisfied with the service?",
    answer: "We offer a dispute resolution center. Please contact our support team immediately if you have issues."
  }
];

export default function SupportPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO 
        title="Help & Support" 
        description="Get help with your account, hiring detectives, or using the platform."
        structuredData={{
          faqs: FAQS
        }}
      />
      <Navbar />
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
        <h1 className="text-4xl font-bold font-heading mb-6">Help Center</h1>
        <p className="text-xl text-gray-600 mb-12">
          Frequently asked questions and support resources.
        </p>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-lg font-medium">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
      <Footer />
    </div>
  );
}
