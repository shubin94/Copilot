import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical, Facebook, Instagram, Twitter, Linkedin, Youtube, Save, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

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

interface FooterCMSProps {
  initialSections?: FooterSection[];
  initialSocialLinks?: SocialLinks;
  initialCopyright?: string;
}

const DEFAULT_SECTIONS: FooterSection[] = [
  {
    id: "categories",
    title: "Categories",
    links: [],
    enabled: true,
    order: 0,
  },
  {
    id: "about",
    title: "About",
    links: [
      { label: "About Us", url: "/about", openInNewTab: false, enabled: true, order: 0 },
      { label: "How It Works", url: "/about#how-it-works", openInNewTab: false, enabled: true, order: 1 },
    ],
    enabled: true,
    order: 1,
  },
  {
    id: "support",
    title: "Support",
    links: [
      { label: "Help Center", url: "/support", openInNewTab: false, enabled: true, order: 0 },
      { label: "Contact Us", url: "/contact", openInNewTab: false, enabled: true, order: 1 },
    ],
    enabled: true,
    order: 2,
  },
  {
    id: "community",
    title: "Community",
    links: [
      { label: "Blog", url: "/blog", openInNewTab: false, enabled: true, order: 0 },
    ],
    enabled: true,
    order: 3,
  },
  {
    id: "more",
    title: "More From Us",
    links: [
      { label: "Terms of Service", url: "/terms", openInNewTab: false, enabled: true, order: 0 },
      { label: "Privacy Policy", url: "/privacy", openInNewTab: false, enabled: true, order: 1 },
    ],
    enabled: true,
    order: 4,
  },
];

export function FooterCMS({ initialSections, initialSocialLinks, initialCopyright }: FooterCMSProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [sections, setSections] = useState<FooterSection[]>(initialSections || DEFAULT_SECTIONS);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(initialSocialLinks || {});
  const [copyrightText, setCopyrightText] = useState(initialCopyright || "© FindDetectives International Ltd. 2025");
  const [isSaving, setIsSaving] = useState(false);

  // Update when initial data changes
  useEffect(() => {
    if (initialSections && initialSections.length > 0) {
      setSections(initialSections);
    }
    if (initialSocialLinks) {
      setSocialLinks(initialSocialLinks);
    }
    if (initialCopyright) {
      setCopyrightText(initialCopyright);
    }
  }, [initialSections, initialSocialLinks, initialCopyright]);

  const addSection = () => {
    const newSection: FooterSection = {
      id: `section-${Date.now()}`,
      title: "New Section",
      links: [],
      enabled: true,
      order: sections.length,
    };
    setSections([...sections, newSection]);
  };

  const updateSection = (index: number, updates: Partial<FooterSection>) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], ...updates };
    setSections(updated);
  };

  const deleteSection = (index: number) => {
    const updated = sections.filter((_: FooterSection, i: number) => i !== index);
    setSections(updated);
  };

  const addLink = (sectionIndex: number) => {
    const updated = [...sections];
    const newLink: FooterLink = {
      label: "New Link",
      url: "/",
      openInNewTab: false,
      enabled: true,
      order: updated[sectionIndex].links.length,
    };
    updated[sectionIndex].links.push(newLink);
    setSections(updated);
  };

  const updateLink = (sectionIndex: number, linkIndex: number, updates: Partial<FooterLink>) => {
    const updated = [...sections];
    updated[sectionIndex].links[linkIndex] = { 
      ...updated[sectionIndex].links[linkIndex], 
      ...updates 
    };
    setSections(updated);
  };

  const deleteLink = (sectionIndex: number, linkIndex: number) => {
    const updated = [...sections];
    updated[sectionIndex].links = updated[sectionIndex].links.filter((_: FooterLink, i: number) => i !== linkIndex);
    setSections(updated);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Validate URLs
      for (const section of sections) {
        for (const link of section.links) {
          // Allow relative URLs (starting with /) or absolute URLs
          if (!link.url.startsWith('/') && !link.url.startsWith('http://') && !link.url.startsWith('https://')) {
            toast({
              title: "Invalid URL",
              description: `Invalid URL in section "${section.title}": ${link.url}. Use relative URLs like "/about" or absolute URLs like "https://example.com"`,
              variant: "destructive",
            });
            setIsSaving(false);
            return;
          }
        }
      }

      // Validate social links
      for (const [platform, url] of Object.entries(socialLinks)) {
        if (url && typeof url === 'string' && url.trim()) {
          try {
            new URL(url);
          } catch {
            toast({
              title: "Invalid URL",
              description: `Invalid ${platform} URL: ${url}`,
              variant: "destructive",
            });
            setIsSaving(false);
            return;
          }
        }
      }

      const payload = {
        footerSections: sections,
        socialLinks: socialLinks,
        copyrightText: copyrightText,
      };

      const response = await api.settings.updateSite(payload);
      await queryClient.invalidateQueries({ queryKey: ["site-settings"] });

      toast({
        title: "Success",
        description: "Footer settings saved successfully",
      });
    } catch (error: any) {
      console.error("Save error:", error);
      
      let errorMessage = "Failed to save footer settings";
      if (error?.status === 401) {
        errorMessage = "You must be logged in as an admin to save footer settings";
      } else if (error?.status === 400) {
        errorMessage = error?.message || "Invalid footer data. Please check your entries.";
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Footer Content Management</h3>
          <p className="text-gray-500 text-sm mt-1">Manage footer sections, links, social media, and copyright text</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-green-600 hover:bg-green-700"
        >
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" /> Save Footer
            </>
          )}
        </Button>
      </div>

      {/* Footer Sections */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Footer Sections</CardTitle>
              <CardDescription>Configure sections and links that appear in the footer</CardDescription>
            </div>
            <Button onClick={addSection} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" /> Add Section
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {sections.map((section, sectionIndex) => (
            <div key={section.id} className="border rounded-lg p-4 space-y-4 bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Section Title</Label>
                      <Input
                        value={section.title}
                        onChange={(e) => updateSection(sectionIndex, { title: e.target.value })}
                        placeholder="Section title"
                      />
                    </div>
                    <div className="flex items-end gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={section.enabled}
                          onCheckedChange={(checked) => updateSection(sectionIndex, { enabled: checked })}
                        />
                        <Label className="text-sm">Enabled</Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSection(sectionIndex)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Links within this section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Links</Label>
                      <Button
                        onClick={() => addLink(sectionIndex)}
                        size="sm"
                        variant="outline"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Link
                      </Button>
                    </div>
                    {section.links.map((link, linkIndex) => (
                      <div key={linkIndex} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border">
                        <Input
                          className="col-span-4"
                          value={link.label}
                          onChange={(e) => updateLink(sectionIndex, linkIndex, { label: e.target.value })}
                          placeholder="Link label"
                        />
                        <Input
                          className="col-span-5"
                          value={link.url}
                          onChange={(e) => updateLink(sectionIndex, linkIndex, { url: e.target.value })}
                          placeholder="/path or https://..."
                        />
                        <div className="col-span-2 flex items-center gap-2">
                          <Switch
                            checked={link.openInNewTab}
                            onCheckedChange={(checked) => updateLink(sectionIndex, linkIndex, { openInNewTab: checked })}
                          />
                          <span className="text-xs">New Tab</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteLink(sectionIndex, linkIndex)}
                          className="col-span-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Social Media Links */}
      <Card>
        <CardHeader>
          <CardTitle>Social Media Links</CardTitle>
          <CardDescription>Add your social media profile URLs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Facebook className="h-4 w-4 text-blue-600" />
                Facebook
              </Label>
              <Input
                value={socialLinks.facebook || ""}
                onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
                placeholder="https://facebook.com/yourpage"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-600" />
                Instagram
              </Label>
              <Input
                value={socialLinks.instagram || ""}
                onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                placeholder="https://instagram.com/yourprofile"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Twitter className="h-4 w-4 text-blue-400" />
                Twitter
              </Label>
              <Input
                value={socialLinks.twitter || ""}
                onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                placeholder="https://twitter.com/yourhandle"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-blue-700" />
                LinkedIn
              </Label>
              <Input
                value={socialLinks.linkedin || ""}
                onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                placeholder="https://linkedin.com/company/yourcompany"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-600" />
                YouTube
              </Label>
              <Input
                value={socialLinks.youtube || ""}
                onChange={(e) => setSocialLinks({ ...socialLinks, youtube: e.target.value })}
                placeholder="https://youtube.com/yourchannel"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Copyright Text */}
      <Card>
        <CardHeader>
          <CardTitle>Copyright Text</CardTitle>
          <CardDescription>Text displayed at the bottom of the footer</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={copyrightText}
            onChange={(e) => setCopyrightText(e.target.value)}
            placeholder="© Your Company Name 2025"
            rows={2}
          />
        </CardContent>
      </Card>
    </div>
  );
}
