import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSiteSettings, useUpdateSiteSettings } from "@/lib/hooks";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function AdminBranding() {
  const { data } = useSiteSettings();
  const update = useUpdateSiteSettings();
  const { toast } = useToast();
  const [logoUrl, setLogoUrl] = useState<string | null>(data?.settings?.logoUrl ?? null);
  const [footerJson, setFooterJson] = useState<string>(() => {
    const arr = (data?.settings?.footerLinks || []) as any[];
    return JSON.stringify(arr, null, 2);
  });

  if (typeof window !== "undefined") {
    // keep preview in sync when settings load
    const s = data?.settings;
    if (s && logoUrl === null) {
      setLogoUrl(s.logoUrl ?? null);
      setFooterJson(JSON.stringify((s.footerLinks || []) as any[], null, 2));
    }
  }

  const handleUploadLogo = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setLogoUrl(url);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    let links: Array<{ label: string; href: string }> = [];
    try {
      const parsed = JSON.parse(footerJson);
      if (!Array.isArray(parsed)) throw new Error("Footer links must be an array");
      links = parsed.map((x: any) => ({ label: String(x.label || "Link"), href: String(x.href || "/") }));
    } catch (e: any) {
      toast({ title: "Invalid footer", description: e.message || "Provide valid JSON array", variant: "destructive" });
      return;
    }
    try {
      const result = await update.mutateAsync({ logoUrl: logoUrl ?? null, footerLinks: links });
      const s = (result as any)?.settings;
      if (s) {
        setLogoUrl(s.logoUrl ?? null);
        setFooterJson(JSON.stringify((s.footerLinks || []) as any[], null, 2));
      }
      toast({ title: "Saved", description: "Branding updated" });
    } catch (error: any) {
      toast({ title: "Failed", description: error.message || "Error saving", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold font-heading text-gray-900">Branding</h2>
          <p className="text-gray-500 mt-1">Manage site logo and footer links</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <CardDescription>Upload a PNG/SVG; max ~1MB</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-12 w-auto" />
            ) : (
              <div className="text-sm text-gray-500">No logo set</div>
            )}
            <Input type="file" accept="image/*" onChange={(e) => e.target.files && handleUploadLogo(e.target.files[0])} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Footer Links</CardTitle>
            <CardDescription>JSON array of {`{ label, href }`}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>Links JSON</Label>
            <Textarea value={footerJson} onChange={(e) => setFooterJson(e.target.value)} className="min-h-40" />
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button className="bg-green-600 hover:bg-green-700" onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
