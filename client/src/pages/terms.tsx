import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO title="Terms and Conditions" description="The terms and conditions for using AskDetectives." />
      <Navbar />
      <main className="flex-1 container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
        <h1 className="text-4xl font-bold font-heading mb-6">Terms and Conditions</h1>
        <div className="prose max-w-none text-gray-600">
          <p className="mb-4 text-sm text-gray-500">Last updated: February 12, 2026</p>
          
          <p className="mb-6 text-lg">
            Welcome to AskDetectives. These Terms and Conditions ("Terms") govern your use of our platform. By accessing or using AskDetectives, you agree to be bound by these Terms. If you do not agree, please do not use our platform.
          </p>

          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-8">
            <p className="text-sm text-red-800">
              <strong>CRITICAL NOTICE:</strong> AskDetectives is ONLY a directory platform that provides information about private investigators. We do NOT provide investigative services, do NOT facilitate transactions, and are NOT responsible for any interactions, agreements, or outcomes between users and detectives. You use this platform and engage detectives entirely AT YOUR OWN RISK.
            </p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
          <p className="mb-4">
            By accessing, browsing, or using AskDetectives, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you are using this platform on behalf of an organization, you represent that you have authority to bind that organization to these Terms.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Platform Purpose and Limitations</h2>
          <p className="mb-4">
            <strong>2.1 Directory Service Only:</strong> AskDetectives is an information directory that displays profiles of private investigators. We provide a platform for discovery and initial contact only. We are NOT:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>A private investigation agency or service provider</li>
            <li>An intermediary, broker, or agent in any transaction</li>
            <li>A party to any agreement between you and any detective</li>
            <li>A payment processor or financial intermediary</li>
            <li>A guarantor of services, quality, or outcomes</li>
          </ul>
          <p className="mb-4">
            <strong>2.2 Information Only:</strong> All detective profiles, service descriptions, pricing, and contact information are provided for informational purposes only. This information does not constitute an endorsement, recommendation, or guarantee by AskDetectives.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. No Responsibility for Detective Information</h2>
          <p className="mb-4">
            <strong>3.1 Detective-Provided Content:</strong> All information about private investigators is provided by the detectives themselves. AskDetectives does NOT:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>Verify credentials, licenses, certifications, or qualifications</li>
            <li>Confirm experience, expertise, or past performance claims</li>
            <li>Validate service descriptions, pricing, or availability</li>
            <li>Investigate backgrounds, check references, or conduct due diligence</li>
            <li>Monitor or update information for accuracy or currency</li>
          </ul>
          <p className="mb-4">
            <strong>3.2 Your Responsibility:</strong> You are solely responsible for independently verifying all detective information, qualifications, licenses, and credentials before engaging any services. AskDetectives strongly recommends conducting thorough due diligence.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. No Responsibility for Transactions or Services</h2>
          <p className="mb-4">
            <strong>4.1 Outside Platform Transactions:</strong> Any agreements, contracts, payments, or transactions between you and a private investigator occur entirely outside our platform and beyond our control. AskDetectives is NOT responsible for:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>The quality, legality, or outcome of investigative services</li>
            <li>Payment disputes, fraud, or non-payment issues</li>
            <li>Breaches of contract or agreement violations</li>
            <li>Delays, cancellations, or failure to provide services</li>
            <li>Accuracy or reliability of investigation results</li>
            <li>Any damages, losses, or harm arising from detective services</li>
            <li>Privacy violations or mishandling of sensitive information</li>
            <li>Illegal activities, misconduct, or unethical behavior by detectives</li>
          </ul>
          <p className="mb-4">
            <strong>4.2 Direct Relationship:</strong> Once you contact a detective, any relationship, communication, or transaction is directly between you and that detective. AskDetectives has no involvement and assumes no liability.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. User Responsibilities and Conduct</h2>
          <p className="mb-4">
            <strong>5.1 Lawful Use:</strong> You agree to use AskDetectives only for lawful purposes. You will NOT:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>Use the platform to facilitate illegal activities</li>
            <li>Provide false, misleading, or fraudulent information</li>
            <li>Harass, threaten, or abuse detectives or other users</li>
            <li>Attempt to circumvent security measures or access restrictions</li>
            <li>Scrape, copy, or misuse detective information for unauthorized purposes</li>
            <li>Impersonate others or misrepresent your identity or affiliation</li>
            <li>Post malicious code, viruses, or harmful materials</li>
          </ul>
          <p className="mb-4">
            <strong>5.2 Age Requirement:</strong> You must be at least 18 years old to use this platform. By using AskDetectives, you represent that you meet this age requirement.
          </p>
          <p className="mb-4">
            <strong>5.3 Due Diligence:</strong> You acknowledge that it is your sole responsibility to:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>Research and verify detective credentials and reputation</li>
            <li>Review applicable laws and regulations in your jurisdiction</li>
            <li>Negotiate clear terms, scope, and pricing with detectives</li>
            <li>Obtain signed contracts or agreements for services</li>
            <li>Protect your own personal information and privacy</li>
            <li>Assess risks and make informed decisions</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Disclaimers and Limitation of Liability</h2>
          <p className="mb-4">
            <strong>6.1 "AS IS" Basis:</strong> AskDetectives is provided on an "AS IS" and "AS AVAILABLE" basis, without any warranties of any kind, express or implied. We disclaim all warranties, including but not limited to:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>Merchantability or fitness for a particular purpose</li>
            <li>Accuracy, reliability, or completeness of information</li>
            <li>Uninterrupted, secure, or error-free operation</li>
            <li>Suitability of any detective for your specific needs</li>
            <li>Quality, legality, or safety of detective services</li>
          </ul>
          <p className="mb-4">
            <strong>6.2 No Liability:</strong> TO THE MAXIMUM EXTENT PERMITTED BY LAW, AskDetectives, its owners, operators, employees, and affiliates SHALL NOT BE LIABLE FOR:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>Any direct, indirect, incidental, special, or consequential damages</li>
            <li>Loss of profits, revenue, data, or business opportunities</li>
            <li>Damages arising from use of or inability to use the platform</li>
            <li>Damages from detective services, conduct, or failures</li>
            <li>Unauthorized access, data breaches, or security incidents</li>
            <li>Errors, inaccuracies, or omissions in platform content</li>
            <li>Any harm, injury, or loss resulting from detective interactions</li>
          </ul>
          <p className="mb-4">
            <strong>6.3 Maximum Liability:</strong> In no event shall our total liability exceed $100 USD or the amount you paid to use the platform (if any), whichever is lower.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Indemnification</h2>
          <p className="mb-4">
            You agree to indemnify, defend, and hold harmless AskDetectives, its owners, operators, employees, and affiliates from any claims, damages, losses, liabilities, costs, and expenses (including legal fees) arising from:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>Your use of the platform or violation of these Terms</li>
            <li>Your interactions, agreements, or disputes with detectives</li>
            <li>Any detective services you engage or outcomes thereof</li>
            <li>Your violation of any laws, regulations, or third-party rights</li>
            <li>Information you provide or submit to the platform</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Detective Listings and Content</h2>
          <p className="mb-4">
            <strong>8.1 No Endorsement:</strong> The presence of a detective profile on AskDetectives does NOT constitute endorsement, approval, certification, or recommendation by us. Inclusion is not a quality indicator.
          </p>
          <p className="mb-4">
            <strong>8.2 Content Removal:</strong> We reserve the right to remove, suspend, or modify any detective profile or content at any time, for any reason, without notice or liability.
          </p>
          <p className="mb-4">
            <strong>8.3 Third-Party Content:</strong> Detective profiles may contain links to external websites or third-party content. We have no control over and assume no responsibility for such external content.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Intellectual Property</h2>
          <p className="mb-4">
            All content, design, logos, and platform features are owned by or licensed to AskDetectives and are protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works without express written permission.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Privacy and Data</h2>
          <p className="mb-4">
            Our Privacy Policy explains how we handle information. Key points:
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li>We collect minimal data necessary for platform operation only</li>
            <li>We do NOT save personal user data, investigation details, or transaction information</li>
            <li>Any information shared with detectives is subject to their privacy practices</li>
            <li>You are responsible for protecting your own sensitive information</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Termination and Access</h2>
          <p className="mb-4">
            <strong>11.1 Right to Terminate:</strong> We reserve the right to terminate or suspend your access to AskDetectives at any time, for any reason, including violation of these Terms, without notice or liability.
          </p>
          <p className="mb-4">
            <strong>11.2 Effect of Termination:</strong> Upon termination, your right to use the platform ceases immediately. All disclaimers, limitations of liability, and indemnification provisions survive termination.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">12. Modifications to Terms</h2>
          <p className="mb-4">
            We may modify these Terms at any time by updating this page with a new "Last updated" date. Changes are effective immediately upon posting. Your continued use after changes constitutes acceptance. We recommend reviewing these Terms periodically.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">13. Governing Law and Disputes</h2>
          <p className="mb-4">
            <strong>13.1 Governing Law:</strong> These Terms are governed by and construed in accordance with applicable laws, without regard to conflict of law principles.
          </p>
          <p className="mb-4">
            <strong>13.2 Dispute Resolution:</strong> You agree to first attempt to resolve any disputes informally by contacting us. If informal resolution fails, disputes shall be resolved through binding arbitration on an individual basis (no class actions).
          </p>
          <p className="mb-4">
            <strong>13.3 Waiver of Class Actions:</strong> You waive any right to bring claims as a class action, collective action, or representative proceeding.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">14. Geographic Limitations</h2>
          <p className="mb-4">
            AskDetectives may be accessed globally, but we make no representation that the platform or detective services are appropriate or available in all jurisdictions. You are responsible for compliance with local laws. Some detective profiles may only serve specific geographic areas.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">15. Severability</h2>
          <p className="mb-4">
            If any provision of these Terms is found invalid or unenforceable, the remaining provisions shall continue in full force and effect. Invalid provisions shall be modified to the minimum extent necessary to make them valid and enforceable.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">16. Entire Agreement</h2>
          <p className="mb-4">
            These Terms, together with our Privacy Policy, constitute the entire agreement between you and AskDetectives regarding use of the platform and supersede all prior agreements or understandings.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">17. No Waiver</h2>
          <p className="mb-4">
            Our failure to enforce any provision of these Terms does not constitute a waiver of that provision or any other provision. No waiver shall be effective unless in writing.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">18. Contact Information</h2>
          <p className="mb-4">
            For questions, concerns, or notices regarding these Terms and Conditions, please contact us at:
          </p>
          <p className="mb-4">
            <strong>Email:</strong> <a href="mailto:contact@askdetectives.com" className="text-blue-600 hover:underline">contact@askdetectives.com</a>
          </p>

          <div className="bg-red-50 border-l-4 border-red-400 p-4 mt-8">
            <h3 className="text-lg font-bold text-red-900 mb-2">FINAL ACKNOWLEDGMENT</h3>
            <p className="text-sm text-red-800 mb-2">
              By using AskDetectives, you explicitly acknowledge and agree that:
            </p>
            <ul className="list-disc ml-6 text-sm text-red-800">
              <li>AskDetectives is ONLY a directory providing information, NOT an investigative service provider</li>
              <li>We do NOT verify, endorse, or guarantee any detective or their services</li>
              <li>We are NOT responsible for any transactions, agreements, or interactions with detectives</li>
              <li>All transactions occur entirely outside our platform and beyond our control</li>
              <li>You proceed entirely AT YOUR OWN RISK in engaging any detective services</li>
              <li>You are solely responsible for due diligence, verification, and decision-making</li>
              <li>We assume NO liability for any outcomes, damages, or losses whatsoever</li>
            </ul>
            <p className="text-sm text-red-800 mt-2 font-bold">
              IF YOU DO NOT AGREE WITH THESE TERMS, DO NOT USE THIS PLATFORM.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
