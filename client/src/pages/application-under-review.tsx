import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, CheckCircle, Mail } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/seo";

export default function ApplicationUnderReview() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <SEO 
        title="Application Status | FindDetectives"
        description="Your detective application is being reviewed. You will be notified once approved."
        robots="noindex, follow"
      />
      <Navbar />
      
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-16 mt-16">
        <div className="max-w-2xl mx-auto">
          <Card className="border-none shadow-lg">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-3xl font-heading">Application Under Review</CardTitle>
              <CardDescription className="text-base mt-2">
                Thank you for submitting your application to FindDetectives!
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <p className="text-blue-900 text-center font-medium">
                  Your application is currently being reviewed by our admin team. You will be notified once approved (usually within 24-48 hours).
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-lg">What Happens Next?</h3>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-green-600 font-bold text-sm">1</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium">Application Review</h4>
                    <p className="text-sm text-gray-600">Our admin team will carefully review your submitted information to ensure it meets our platform standards.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-green-600 font-bold text-sm">2</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium">Verification & Approval</h4>
                    <p className="text-sm text-gray-600">Once verified, your account will be approved and you'll receive an email with login credentials.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium">Start Offering Services</h4>
                    <p className="text-sm text-gray-600">After approval, you can log in, create your profile, list your services, and start connecting with clients!</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 flex items-start gap-3">
                <Mail className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-700">
                  <p className="font-medium mb-1">Check your email</p>
                  <p>We'll send you a confirmation email with further instructions once your application has been reviewed.</p>
                </div>
              </div>

              <div className="pt-4 flex justify-center">
                <Link href="/">
                  <Button variant="outline" data-testid="button-back-home">
                    Back to Home
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
