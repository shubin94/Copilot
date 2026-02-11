import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface FAQ {
  question: string;
  answer: string;
}

interface ServiceFAQProps {
  service: {
    title: string;
    category?: string;
    basePrice?: number;
    offerPrice?: number;
    isOnEnquiry?: boolean;
  };
  detective: {
    businessName?: string;
    city?: string;
    country?: string;
    phone?: string;
    whatsapp?: string;
    contactEmail?: string;
  };
  formatPrice?: (price: number) => string;
}

export function ServiceFAQ({ service, detective, formatPrice }: ServiceFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  // Generate dynamic FAQs based on service data
  const faqs: FAQ[] = [];

  // Pricing question
  if (service.isOnEnquiry) {
    faqs.push({
      question: `How much does ${service.title} cost?`,
      answer: `The pricing for ${service.title} is provided on enquiry. Please contact ${detective.businessName || 'our team'} directly to get a customized quote based on your specific requirements.`
    });
  } else if (service.basePrice) {
    const priceDisplay = formatPrice 
      ? formatPrice(service.offerPrice || service.basePrice)
      : `₹${service.offerPrice || service.basePrice}`;
    faqs.push({
      question: `How much does ${service.title} cost?`,
      answer: `${service.title} starts at ${priceDisplay}. Final pricing may vary based on your specific requirements and the complexity of your case.`
    });
  }

  // Location question
  if (detective.city && detective.country) {
    faqs.push({
      question: `Where is this service available?`,
      answer: `${detective.businessName || 'This detective agency'} provides ${service.title} services in ${detective.city}, ${detective.country}. They may also serve surrounding areas - please contact them for details about service coverage.`
    });
  } else if (detective.country) {
    faqs.push({
      question: `Where is this service available?`,
      answer: `${detective.businessName || 'This detective agency'} provides ${service.title} services in ${detective.country}. Please contact them for specific coverage areas.`
    });
  }

  // Contact question
  const contactMethods = [];
  if (detective.phone) contactMethods.push('phone');
  if (detective.whatsapp) contactMethods.push('WhatsApp');
  if (detective.contactEmail) contactMethods.push('email');
  
  if (contactMethods.length > 0) {
    faqs.push({
      question: `How can I contact ${detective.businessName || 'the detective'} for this service?`,
      answer: `You can reach ${detective.businessName || 'the detective'} via ${contactMethods.join(', ')}. Use the contact buttons on this page to get in touch directly.`
    });
  }

  // Service type question
  if (service.category) {
    faqs.push({
      question: `What type of investigation service is this?`,
      answer: `${service.title} is a ${service.category} service offered by ${detective.businessName || 'this detective agency'}. This type of investigation is designed to help you gather information and evidence professionally.`
    });
  }

  // Delivery/timeline question
  faqs.push({
    question: `How long does this investigation take?`,
    answer: `The timeline for ${service.title} varies depending on the complexity of your case and specific requirements. ${detective.businessName || 'The detective'} will provide an estimated timeline after discussing your needs.`
    });

  // Confidentiality question
  faqs.push({
    question: `Is this service confidential?`,
    answer: `Yes, all detective services including ${service.title} are handled with strict confidentiality. ${detective.businessName || 'This detective agency'} follows professional standards to protect your privacy and the sensitive nature of your investigation.`
  });

  if (faqs.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
      <div className="space-y-3">
        {faqs.map((faq, index) => (
          <Card key={index} className="border border-gray-200">
            <CardContent className="p-0">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
              >
                <h3 className="font-semibold text-gray-900 pr-4">{faq.question}</h3>
                <ChevronDown
                  className={`h-5 w-5 text-gray-500 flex-shrink-0 transition-transform ${
                    openIndex === index ? 'transform rotate-180' : ''
                  }`}
                />
              </button>
              {openIndex === index && (
                <div className="px-4 pb-4 text-gray-700 leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Export function to get FAQs as plain objects for SEO schema
export function getServiceFAQs(
  service: ServiceFAQProps['service'],
  detective: ServiceFAQProps['detective'],
  formatPrice?: (price: number) => string
): FAQ[] {
  const faqs: FAQ[] = [];

  // Pricing question
  if (service.isOnEnquiry) {
    faqs.push({
      question: `How much does ${service.title} cost?`,
      answer: `The pricing for ${service.title} is provided on enquiry. Please contact ${detective.businessName || 'our team'} directly to get a customized quote based on your specific requirements.`
    });
  } else if (service.basePrice) {
    const priceDisplay = formatPrice 
      ? formatPrice(service.offerPrice || service.basePrice)
      : `₹${service.offerPrice || service.basePrice}`;
    faqs.push({
      question: `How much does ${service.title} cost?`,
      answer: `${service.title} starts at ${priceDisplay}. Final pricing may vary based on your specific requirements and the complexity of your case.`
    });
  }

  // Location question
  if (detective.city && detective.country) {
    faqs.push({
      question: `Where is this service available?`,
      answer: `${detective.businessName || 'This detective agency'} provides ${service.title} services in ${detective.city}, ${detective.country}. They may also serve surrounding areas - please contact them for details about service coverage.`
    });
  } else if (detective.country) {
    faqs.push({
      question: `Where is this service available?`,
      answer: `${detective.businessName || 'This detective agency'} provides ${service.title} services in ${detective.country}. Please contact them for specific coverage areas.`
    });
  }

  // Contact question
  const contactMethods = [];
  if (detective.phone) contactMethods.push('phone');
  if (detective.whatsapp) contactMethods.push('WhatsApp');
  if (detective.contactEmail) contactMethods.push('email');
  
  if (contactMethods.length > 0) {
    faqs.push({
      question: `How can I contact ${detective.businessName || 'the detective'} for this service?`,
      answer: `You can reach ${detective.businessName || 'the detective'} via ${contactMethods.join(', ')}. Use the contact buttons on this page to get in touch directly.`
    });
  }

  // Service type question
  if (service.category) {
    faqs.push({
      question: `What type of investigation service is this?`,
      answer: `${service.title} is a ${service.category} service offered by ${detective.businessName || 'this detective agency'}. This type of investigation is designed to help you gather information and evidence professionally.`
    });
  }

  // Delivery/timeline question
  faqs.push({
    question: `How long does this investigation take?`,
    answer: `The timeline for ${service.title} varies depending on the complexity of your case and specific requirements. ${detective.businessName || 'The detective'} will provide an estimated timeline after discussing your needs.`
  });

  // Confidentiality question
  faqs.push({
    question: `Is this service confidential?`,
    answer: `Yes, all detective services including ${service.title} are handled with strict confidentiality. ${detective.businessName || 'This detective agency'} follows professional standards to protect your privacy and the sensitive nature of your investigation.`
  });

  return faqs;
}
