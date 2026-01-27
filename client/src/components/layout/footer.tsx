import { Link } from "wouter";
import { useSiteSettings } from "@/lib/hooks";
import { Facebook, Instagram, Twitter, Linkedin, Youtube } from "lucide-react";

interface FooterLink {
  label: string;
  url: string;
  openInNewTab: boolean;
  enabled: boolean;
  order: number;
}

interface FooterSection {
  id: string;
  title: string;
  links: FooterLink[];
  enabled: boolean;
  order: number;
}

interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
}

const DEFAULT_SECTIONS: FooterSection[] = [
  {
    id: "categories",
    title: "Categories",
    links: [
      { label: "Background Checks", url: "/search", openInNewTab: false, enabled: true, order: 0 },
      { label: "Surveillance", url: "/search", openInNewTab: false, enabled: true, order: 1 },
      { label: "Cyber Investigations", url: "/search", openInNewTab: false, enabled: true, order: 2 },
      { label: "Asset Search", url: "/search", openInNewTab: false, enabled: true, order: 3 },
      { label: "Missing Persons", url: "/search", openInNewTab: false, enabled: true, order: 4 },
    ],
    enabled: true,
    order: 0,
  },
  {
    id: "about",
    title: "About",
    links: [
      { label: "About Us", url: "/about", openInNewTab: false, enabled: true, order: 0 },
      { label: "Privacy Policy", url: "/privacy", openInNewTab: false, enabled: true, order: 1 },
      { label: "Terms of Service", url: "/terms", openInNewTab: false, enabled: true, order: 2 },
      { label: "Contact Us", url: "/contact", openInNewTab: false, enabled: true, order: 3 },
    ],
    enabled: true,
    order: 1,
  },
  {
    id: "support",
    title: "Support",
    links: [
      { label: "Help & Support", url: "/support", openInNewTab: false, enabled: true, order: 0 },
      { label: "Become a Detective", url: "/detective-signup", openInNewTab: false, enabled: true, order: 1 },
      { label: "Pricing & Packages", url: "/packages", openInNewTab: false, enabled: true, order: 2 },
      { label: "Login as Detective", url: "/login", openInNewTab: false, enabled: true, order: 3 },
      { label: "Signup as User", url: "/signup", openInNewTab: false, enabled: true, order: 4 },
    ],
    enabled: true,
    order: 2,
  },
  {
    id: "community",
    title: "Community",
    links: [
      { label: "Blog", url: "/blog", openInNewTab: false, enabled: true, order: 0 },
      { label: "Events", url: "/", openInNewTab: false, enabled: true, order: 1 },
      { label: "Forum", url: "/", openInNewTab: false, enabled: true, order: 2 },
      { label: "Podcast", url: "/", openInNewTab: false, enabled: true, order: 3 },
    ],
    enabled: true,
    order: 3,
  },
  {
    id: "more",
    title: "More From Us",
    links: [
      { label: "FindDetectives Pro", url: "/", openInNewTab: false, enabled: true, order: 0 },
      { label: "FindDetectives Enterprise", url: "/", openInNewTab: false, enabled: true, order: 1 },
      { label: "FindDetectives Logo Maker", url: "/", openInNewTab: false, enabled: true, order: 2 },
    ],
    enabled: true,
    order: 4,
  },
];

export function Footer() {
  const { data: siteData } = useSiteSettings();
  const site = siteData?.settings;
  
  // Get footer sections from DB or use defaults
  const footerSections = (site?.footerSections as FooterSection[]) || DEFAULT_SECTIONS;
  const socialLinks = (site?.socialLinks as SocialLinks) || {};
  const copyrightText = site?.copyrightText || "© FindDetectives International Ltd. 2025";
  
  // Debug logging
  if (typeof window !== 'undefined') {
    console.log("🔍 Footer component received site data:", {
      hasFooterSections: !!site?.footerSections,
      sectionsCount: (site?.footerSections as any)?.length || 0,
      socialLinksKeys: Object.keys(socialLinks),
      copyrightText: copyrightText
    });
  }
  
  // Filter and sort enabled sections
  const enabledSections = footerSections
    .filter(section => section.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <footer className="border-t border-gray-200 bg-white pt-16 pb-8 text-gray-600">
      <div className="container mx-auto px-6 md:px-12 lg:px-24">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
          {enabledSections.map((section) => {
            // Filter and sort enabled links
            const enabledLinks = section.links
              .filter(link => link.enabled)
              .sort((a, b) => a.order - b.order);

            return (
              <div key={section.id} className="flex flex-col gap-4">
                <h4 className="font-bold text-gray-900">{section.title}</h4>
            {enabledLinks.map((link, index) => {
                  // Handle external vs internal links
                  const isExternal = link.url.startsWith('http');
                  
                  if (isExternal || link.openInNewTab) {
                    return (
                      <a
                        key={index}
                        href={link.url}
                        target={link.openInNewTab ? "_blank" : undefined}
                        rel={link.openInNewTab ? "noopener noreferrer" : undefined}
                        className="hover:underline"
                      >
                        {link.label}
                      </a>
                    );
                  }
                  
                  return (
                    <Link key={index} href={link.url} className="hover:underline">
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
        
        <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {(() => {
              // Use footerLogoUrl, fallback to headerLogoUrl, then logoUrl
              const logo = site?.footerLogoUrl || site?.headerLogoUrl || site?.logoUrl;
              
              return logo ? (
                <img src={logo} alt="Footer Logo" className="h-8 w-auto" />
              ) : (
                <span className="text-2xl font-bold tracking-tight font-heading flex items-center gap-1 text-gray-400">
                  Find<span className="">Detectives</span>
                  <span className="text-4xl leading-none">.</span>
                </span>
              );
            })()}
            <span className="text-sm">{copyrightText}</span>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Social Icons */}
            <div className="flex gap-4">
              {socialLinks.facebook && (
                <a
                  href={socialLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="w-5 h-5" />
                </a>
              )}
              {socialLinks.instagram && (
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-pink-600 transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {socialLinks.twitter && (
                <a
                  href={socialLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-blue-400 transition-colors"
                  aria-label="Twitter"
                >
                  <Twitter className="w-5 h-5" />
                </a>
              )}
              {socialLinks.linkedin && (
                <a
                  href={socialLinks.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-blue-700 transition-colors"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="w-5 h-5" />
                </a>
              )}
              {socialLinks.youtube && (
                <a
                  href={socialLinks.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  aria-label="YouTube"
                >
                  <Youtube className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
