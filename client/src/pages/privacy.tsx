import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO title="Privacy Policy" description="Our commitment to protecting your privacy and data." />
      <Navbar />
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
        <h1 className="text-4xl font-bold font-heading mb-6">Privacy Policy</h1>
        <div className="prose max-w-none text-gray-600">
          <p className="mb-4 text-sm text-gray-500">Last updated: February 12, 2026</p>
          
          <p className="mb-6 text-lg">
            AskDetectives ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we handle information on our platform, which serves as a directory connecting users with private investigators.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Our Role as a Directory Platform</h2>
          <p className="mb-4">
            AskDetectives operates solely as a directory and information platform. We provide a space where private investigators can list their services and where users can discover and contact them. We do not provide investigative services directly, nor do we act as an intermediary in any transactions between users and detectives.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Information We Do NOT Save</h2>
          <p className="mb-4">
            <strong>We do not save or store personal user data beyond what is absolutely necessary for platform functionality.</strong> Specifically:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>We do not store personal conversations between users and detectives</li>
            <li>We do not store transaction details or payment information</li>
            <li>We do not retain sensitive personal information shared during inquiries</li>
            <li>We do not track or record communications that occur outside our platform</li>
            <li>We do not store case details, investigation information, or client files</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Minimal Information Collection</h2>
          <p className="mb-4">
            For basic platform functionality, we may collect only:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li><strong>Session Data:</strong> Temporary session information to enable browsing (automatically deleted)</li>
            <li><strong>Anonymous Analytics:</strong> General usage patterns to improve the platform (no personal identification)</li>
            <li><strong>Detective Profiles:</strong> Information provided by detectives for their public listings (name, services, location, contact information)</li>
            <li><strong>Contact Form Data:</strong> When you submit an inquiry through our platform, basic contact information necessary to connect you with the detective</li>
          </ul>
          <p className="mb-4">
            <strong>Important:</strong> Any account information you create is minimal and used only for accessing detective profiles. We do not build user profiles or track your activity across sessions.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Detective-Provided Information</h2>
          <p className="mb-4">
            The information displayed about private investigators on our platform is provided directly by the detectives themselves. We are not responsible for:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>The accuracy, completeness, or truthfulness of detective profiles</li>
            <li>Credentials, licenses, or certifications claimed by detectives</li>
            <li>Service descriptions, pricing, or availability information</li>
            <li>Contact information or communication preferences</li>
          </ul>
          <p className="mb-4">
            Users are responsible for independently verifying all information before engaging any detective's services.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Third-Party Interactions</h2>
          <p className="mb-4">
            Once you leave our platform or make direct contact with a private investigator:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>Any information you share is subject to the detective's own privacy practices</li>
            <li>We have no control over how detectives handle your personal information</li>
            <li>We are not involved in any contracts, agreements, or transactions between you and detectives</li>
            <li>We do not receive copies of communications, case files, or investigation details</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Cookies and Tracking</h2>
          <p className="mb-4">
            We use minimal cookies solely for:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>Essential session management (to keep you logged in during browsing)</li>
            <li>Basic security features (CSRF protection)</li>
            <li>Anonymous analytics to understand general usage patterns</li>
          </ul>
          <p className="mb-4">
            We do NOT use tracking cookies for advertising, behavioral profiling, or cross-site tracking. You may disable cookies in your browser, though some platform features may be limited.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Data Security</h2>
          <p className="mb-4">
            While we collect minimal information, we implement reasonable technical and organizational measures to protect any data temporarily processed through our platform. However, no method of transmission over the internet is 100% secure. You acknowledge and accept the inherent risks of using online platforms.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Third-Party Services</h2>
          <p className="mb-4">
            Our platform may use third-party services for:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>Hosting and infrastructure</li>
            <li>Anonymous analytics</li>
            <li>Email delivery for system notifications</li>
          </ul>
          <p className="mb-4">
            These services have their own privacy policies. We do not share personal information with third parties for marketing purposes.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Your Rights and Choices</h2>
          <p className="mb-4">
            Since we collect minimal data, there is typically little personal information to manage. However, you may:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>Browse detective profiles without creating an account</li>
            <li>Request deletion of any account information you created</li>
            <li>Opt out of any non-essential communications</li>
            <li>Contact us to inquire about what minimal data may exist</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Children's Privacy</h2>
          <p className="mb-4">
            Our platform is not directed to individuals under 18 years of age. We do not knowingly collect information from minors. If we become aware that a minor has provided information, we will take steps to delete it immediately.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. International Users</h2>
          <p className="mb-4">
            AskDetectives may be accessed from various countries. By using our platform, you acknowledge that any information processed may be transferred to and processed in different jurisdictions. We do not guarantee compliance with all international privacy regulations.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">12. Changes to This Privacy Policy</h2>
          <p className="mb-4">
            We may update this Privacy Policy from time to time. We will notify users of material changes by updating the "Last updated" date. Your continued use of the platform after changes constitutes acceptance of the updated policy.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">13. Contact Us</h2>
          <p className="mb-4">
            If you have questions or concerns about this Privacy Policy or our data practices, please contact us at:
          </p>
          <p className="mb-4">
            <strong>Email:</strong> <a href="mailto:contact@askdetectives.com" className="text-blue-600 hover:underline">contact@askdetectives.com</a>
          </p>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-8">
            <p className="text-sm text-yellow-800">
              <strong>Important Disclaimer:</strong> AskDetectives is a directory platform only. We do not save your personal data, investigation details, or transaction information. All interactions with private investigators occur independently, and you proceed entirely at your own risk. We strongly recommend conducting your own due diligence before engaging any investigative services.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
