import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { Image as ImageIcon, Upload, X, RefreshCw, Save, Plus, Trash2, GripVertical, Facebook, Instagram, Twitter, Linkedin, Youtube } from "lucide-react";
import { useSiteSettings } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { FooterCMS } from "@/components/admin/footer-cms";

interface LogoState {
  preview: string | null;
  file: File | null;
  dataUrl: string | null;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: siteData, isLoading } = useSiteSettings();
  const site = siteData?.settings;

  const [isSaving, setIsSaving] = useState(false);
  
  // Logo states for 3 separate logos
  const [headerLogo, setHeaderLogo] = useState<LogoState>({ preview: null, file: null, dataUrl: null });
  const [stickyLogo, setStickyLogo] = useState<LogoState>({ preview: null, file: null, dataUrl: null });
  const [footerLogo, setFooterLogo] = useState<LogoState>({ preview: null, file: null, dataUrl: null });
  
  // Hero and features images
  const [heroBackground, setHeroBackground] = useState<LogoState>({ preview: null, file: null, dataUrl: null });
  const [featuresImage, setFeaturesImage] = useState<LogoState>({ preview: null, file: null, dataUrl: null });

  // Refs for file inputs
  const headerInputRef = useRef<HTMLInputElement>(null);
  const stickyInputRef = useRef<HTMLInputElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const featuresInputRef = useRef<HTMLInputElement>(null);

  // Load existing logos when site data loads
  useEffect(() => {
    if (site) {
      if (site.headerLogoUrl) {
        setHeaderLogo({ preview: site.headerLogoUrl, file: null, dataUrl: null });
      } else if (site.logoUrl) {
        // Fallback to legacy logoUrl
        setHeaderLogo({ preview: site.logoUrl, file: null, dataUrl: null });
      }
      
      if (site.stickyHeaderLogoUrl) {
        setStickyLogo({ preview: site.stickyHeaderLogoUrl, file: null, dataUrl: null });
      } else if (site.logoUrl) {
        setStickyLogo({ preview: site.logoUrl, file: null, dataUrl: null });
      }
      
      if (site.footerLogoUrl) {
        setFooterLogo({ preview: site.footerLogoUrl, file: null, dataUrl: null });
      } else if (site.logoUrl) {
        setFooterLogo({ preview: site.logoUrl, file: null, dataUrl: null });
      }
      
      if (site.heroBackgroundImage) {
        setHeroBackground({ preview: site.heroBackgroundImage, file: null, dataUrl: null });
      }
      
      if (site.featuresImage) {
        setFeaturesImage({ preview: site.featuresImage, file: null, dataUrl: null });
      }
    }
  }, [site]);

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setState: React.Dispatch<React.SetStateAction<LogoState>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ 
        title: "Invalid File", 
        description: "Please select an image file", 
        variant: "destructive" 
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ 
        title: "File Too Large", 
        description: "Image must be less than 2MB", 
        variant: "destructive" 
      });
      return;
    }

    // Convert to data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setState({
        preview: dataUrl,
        file,
        dataUrl
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const payload: any = {};

      // Include changed logos
      if (headerLogo.dataUrl) {
        payload.headerLogoUrl = headerLogo.dataUrl;
      } else if (headerLogo.preview === null && (site?.headerLogoUrl || site?.logoUrl)) {
        payload.headerLogoUrl = null;
      }

      if (stickyLogo.dataUrl) {
        payload.stickyHeaderLogoUrl = stickyLogo.dataUrl;
      } else if (stickyLogo.preview === null && (site?.stickyHeaderLogoUrl || site?.logoUrl)) {
        payload.stickyHeaderLogoUrl = null;
      }

      if (footerLogo.dataUrl) {
        payload.footerLogoUrl = footerLogo.dataUrl;
      } else if (footerLogo.preview === null && (site?.footerLogoUrl || site?.logoUrl)) {
        payload.footerLogoUrl = null;
      }
      
      if (heroBackground.dataUrl) {
        payload.heroBackgroundImage = heroBackground.dataUrl;
      } else if (heroBackground.preview === null && site?.heroBackgroundImage) {
        payload.heroBackgroundImage = null;
      }
      
      if (featuresImage.dataUrl) {
        payload.featuresImage = featuresImage.dataUrl;
      } else if (featuresImage.preview === null && site?.featuresImage) {
        payload.featuresImage = null;
      }

      // Only send request if there are changes
      if (Object.keys(payload).length === 0) {
        toast({ 
          title: "No Changes", 
          description: "No logos were modified" 
        });
        return;
      }

      const updated = await api.settings.updateSite(payload);
      
      // Update cache immediately and also mark stale
      queryClient.setQueryData(["settings", "site"], updated);
      await queryClient.invalidateQueries({ queryKey: ["settings", "site"] });
      
      toast({ 
        title: "Success", 
        description: "Site branding updated successfully" 
      });

      // Reset file states (keep previews)
      setHeaderLogo(prev => ({ ...prev, file: null, dataUrl: null }));
      setStickyLogo(prev => ({ ...prev, file: null, dataUrl: null }));
      setFooterLogo(prev => ({ ...prev, file: null, dataUrl: null }));
      setHeroBackground(prev => ({ ...prev, file: null, dataUrl: null }));
      setFeaturesImage(prev => ({ ...prev, file: null, dataUrl: null }));

    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update site branding", 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = (setState: React.Dispatch<React.SetStateAction<LogoState>>) => {
    setState({ preview: null, file: null, dataUrl: null });
  };

  const handleResetAll = () => {
    if (site?.headerLogoUrl || site?.logoUrl) {
      setHeaderLogo({ preview: site.headerLogoUrl || site.logoUrl || null, file: null, dataUrl: null });
    } else {
      setHeaderLogo({ preview: null, file: null, dataUrl: null });
    }
    
    if (site?.stickyHeaderLogoUrl || site?.logoUrl) {
      setStickyLogo({ preview: site.stickyHeaderLogoUrl || site.logoUrl || null, file: null, dataUrl: null });
    } else {
      setStickyLogo({ preview: null, file: null, dataUrl: null });
    }
    
    if (site?.footerLogoUrl || site?.logoUrl) {
      setFooterLogo({ preview: site.footerLogoUrl || site.logoUrl || null, file: null, dataUrl: null });
    } else {
      setFooterLogo({ preview: null, file: null, dataUrl: null });
    }
    
    if (site?.heroBackgroundImage) {
      setHeroBackground({ preview: site.heroBackgroundImage, file: null, dataUrl: null });
    } else {
      setHeroBackground({ preview: null, file: null, dataUrl: null });
    }
    
    if (site?.featuresImage) {
      setFeaturesImage({ preview: site.featuresImage, file: null, dataUrl: null });
    } else {
      setFeaturesImage({ preview: null, file: null, dataUrl: null });
    }
    
    toast({ title: "Reset", description: "All changes discarded" });
  };

  const LogoUploadCard = ({ 
    title, 
    description, 
    state, 
    setState, 
    inputRef 
  }: { 
    title: string; 
    description: string; 
    state: LogoState; 
    setState: React.Dispatch<React.SetStateAction<LogoState>>;
    inputRef: React.RefObject<HTMLInputElement>;
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-green-600" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.preview ? (
          <div className="space-y-4">
            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-8 bg-gray-50 flex items-center justify-center min-h-[160px]">
              <img 
                src={state.preview} 
                alt={title} 
                className="max-h-32 max-w-full object-contain"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => handleClear(setState)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" /> Change Image
            </Button>
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-green-500 transition-colors min-h-[160px] flex flex-col items-center justify-center"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 mb-2">Click to upload or drag and drop</p>
            <p className="text-xs text-gray-500">PNG, JPG, SVG up to 2MB</p>
          </div>
        )}
        <Input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e, setState)}
        />
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-green-600" />
        </div>
      </DashboardLayout>
    );
  }

  const hasChanges = headerLogo.dataUrl || stickyLogo.dataUrl || footerLogo.dataUrl || heroBackground.dataUrl || featuresImage.dataUrl;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold font-heading text-gray-900">Site Settings</h2>
          <p className="text-gray-500 mt-1">Manage global branding, logos, and footer content</p>
        </div>

        <Tabs defaultValue="logos" className="space-y-6">
          <TabsList>
            <TabsTrigger value="logos">Logo Settings</TabsTrigger>
            <TabsTrigger value="home">Home Page Images</TabsTrigger>
            <TabsTrigger value="footer">Footer Content</TabsTrigger>
          </TabsList>

          <TabsContent value="logos" className="space-y-6">
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={handleResetAll} disabled={isSaving}>
                <RefreshCw className="h-4 w-4 mr-2" /> Reset
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isSaving || !hasChanges}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" /> Save Logos
                  </>
                )}
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
              <LogoUploadCard
                title="Header Logo"
                description="Main logo displayed in the site header"
                state={headerLogo}
                setState={setHeaderLogo}
                inputRef={headerInputRef}
              />

              <LogoUploadCard
                title="Sticky Header Logo"
                description="Logo shown when user scrolls down"
                state={stickyLogo}
                setState={setStickyLogo}
                inputRef={stickyInputRef}
              />

              <LogoUploadCard
                title="Footer Logo"
                description="Logo displayed in the site footer"
                state={footerLogo}
                setState={setFooterLogo}
                inputRef={footerInputRef}
              />
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900">Logo Usage Guide</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-3">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold mb-2">Header Logo</h4>
                    <p className="text-xs text-blue-700">Appears on all pages in the main navigation bar before scrolling</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold mb-2">Sticky Header Logo</h4>
                    <p className="text-xs text-blue-700">Replaces header logo when navigation becomes fixed after scrolling</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold mb-2">Footer Logo</h4>
                    <p className="text-xs text-blue-700">Displayed at the bottom of every page</p>
                  </div>
                </div>
                <div className="pt-2 space-y-1">
                  <p className="text-xs">• <strong>Recommended:</strong> PNG with transparent background</p>
                  <p className="text-xs">• <strong>Optimal dimensions:</strong> 200x50px (width x height)</p>
                  <p className="text-xs">• <strong>Max file size:</strong> 2MB per image</p>
                  <p className="text-xs">• <strong>Tip:</strong> You can use different logos for each location to match the design context</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="home" className="space-y-6">
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={handleResetAll} disabled={isSaving}>
                <RefreshCw className="h-4 w-4 mr-2" /> Reset
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isSaving || !hasChanges}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" /> Save Images
                  </>
                )}
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              <LogoUploadCard
                title="Hero Background Image"
                description="Background image for the hero section on the home page"
                state={heroBackground}
                setState={setHeroBackground}
                inputRef={heroInputRef}
              />

              <LogoUploadCard
                title="Features Section Image"
                description="Image displayed in the features/highlights section"
                state={featuresImage}
                setState={setFeaturesImage}
                inputRef={featuresInputRef}
              />
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900">Home Page Image Guide</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-3">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold mb-2">Hero Background</h4>
                    <p className="text-xs text-blue-700">Large banner image shown at the top of the home page behind the main headline</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold mb-2">Features Image</h4>
                    <p className="text-xs text-blue-700">Highlighted image in the features/benefits section of the home page</p>
                  </div>
                </div>
                <div className="pt-2 space-y-1">
                  <p className="text-xs">• <strong>Hero Background:</strong> Recommended 1920x600px (landscape)</p>
                  <p className="text-xs">• <strong>Features Image:</strong> Recommended 800x600px (portrait/square)</p>
                  <p className="text-xs">• <strong>Max file size:</strong> 2MB per image</p>
                  <p className="text-xs">• <strong>Tip:</strong> Use high-quality images that align with your brand identity</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="footer">
            <FooterCMS 
              initialSections={(site?.footerSections as any) || []}
              initialSocialLinks={(site?.socialLinks as any) || {}}
              initialCopyright={site?.copyrightText || ""}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

