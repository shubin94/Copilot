import { Link } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  {
    question: "How do I hire a detective?",
    answer: "Simply browse our search page, filter by your needs, and click 'Contact' or 'Hire' on a detective's profile.",
    content: <>Simply browse our <Link href="/detectives" className="text-blue-600 hover:underline">available detectives</Link>, filter by your needs (based on <Link href="/services" className="text-blue-600 hover:underline">services offered</Link>), and click 'Contact' or 'Hire' on a detective's profile.</>
  },
  {
    question: "Is my information kept private?",
    answer: "Yes, we take privacy very seriously. All communications are secure and we do not share your personal details without consent.",
    content: <>Yes, we take privacy very seriously. All communications are secure and we do not share your personal details without consent. Read our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.</>
  },
  {
    question: "How are detectives verified?",
    answer: "We conduct manual reviews of licenses, insurance, and background checks for all 'Verified' and 'Agency' tier detectives.",
    content: <>We conduct manual reviews of licenses, insurance, and background checks for all 'Verified' and 'Agency' tier detectives. Explore <Link href="/detectives" className="text-blue-600 hover:underline">verified detectives</Link> on our platform.</>
  },
  {
    question: "What if I'm not satisfied with the service?",
    answer: "We offer a dispute resolution center. Please contact our support team immediately if you have issues.",
    content: <>We offer a dispute resolution center. Please <Link href="/contact" className="text-blue-600 hover:underline">contact our support team</Link> immediately if you have issues.</>
  }
];

export default function SupportPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO 
        title="Support Center & FAQ | AskDetectives" 
        description="Find answers to common questions about hiring a detective, privacy policies, and verification processes at AskDetectives."
        canonical="https://www.askdetectives.com/support"
        structuredData={{
          faqs: FAQS
        }}
      />
      {/* Breadcrumb Schema for Rich Snippets */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [{
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://www.askdetectives.com/"
          },{
            "@type": "ListItem",
            "position": 2,
            "name": "Support",
            "item": "https://www.askdetectives.com/support"
          }]
        })}
      </script>
      <Navbar />
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
        <h1 className="text-4xl font-bold font-heading mb-6">Help Center</h1>
        <h2 className="text-xl text-gray-600 font-normal mb-12">
          Frequently asked questions and support resources.
        </h2>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-lg font-medium">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  {faq.content || faq.answer}
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
