import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Lock, Save, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SecretItem {
  key: string;
  value: string;
  hasValue: boolean;
}

const KEY_LABELS: Record<string, string> = {
  host: "Server Host",
  google_client_id: "Google OAuth Client ID",
  google_client_secret: "Google OAuth Client Secret",
  session_secret: "Session Secret",
  base_url: "Base URL",
  supabase_url: "Supabase URL",
  supabase_service_role_key: "Supabase Service Role Key",
  sendgrid_api_key: "SendGrid API Key",
  sendgrid_from_email: "SendGrid From Email",
  smtp_host: "SMTP Host",
  smtp_port: "SMTP Port",
  smtp_secure: "SMTP Secure",
  smtp_user: "SMTP User",
  smtp_pass: "SMTP Password",
  smtp_from_email: "SMTP From Email",
  sendpulse_api_id: "SendPulse API ID",
  sendpulse_api_secret: "SendPulse API Secret",
  sendpulse_sender_email: "SendPulse Sender Email",
  sendpulse_sender_name: "SendPulse Sender Name",
  sendpulse_enabled: "SendPulse Enabled",
  razorpay_key_id: "Razorpay Key ID",
  razorpay_key_secret: "Razorpay Key Secret",
  paypal_client_id: "PayPal Client ID",
  paypal_client_secret: "PayPal Client Secret",
  paypal_mode: "PayPal Mode",
  gemini_api_key: "Gemini API Key",
};

export default function AdminAppSecrets() {
  const { toast } = useToast();
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSecrets();
  }, []);

  const fetchSecrets = async () => {
    try {
      const response = await api.get<{ secrets: SecretItem[] }>("/api/admin/app-secrets");
      setSecrets(response.secrets);
      const initial: Record<string, string> = {};
      response.secrets.forEach((s) => { initial[s.key] = ""; });
      setEditValues(initial);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load app secrets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string) => {
    const value = editValues[key]?.trim();
    if (value === undefined || value === "") {
      toast({ title: "Error", description: "Value cannot be empty", variant: "destructive" });
      return;
    }
    setSaving(key);
    try {
      await api.put(`/api/admin/app-secrets/${key}`, { value });
      toast({ title: "Success", description: "Secret saved. Restart server to apply." });
      setEditValues((prev) => ({ ...prev, [key]: "" }));
      await fetchSecrets();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to save secret",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              App Secrets (Auth & API)
            </CardTitle>
            <CardDescription>
              Store Google OAuth, Supabase, email, and payment credentials in the database. Only DATABASE_URL is required in .env.
              Secrets are loaded at server startup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Values are masked. Enter a new value and click Save to update. Restart the server after saving.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {secrets.map((s) => (
                <div key={s.key} className="flex flex-col gap-2">
                  <Label htmlFor={s.key}>{KEY_LABELS[s.key] || s.key}</Label>
                  <div className="flex gap-2">
                    <Input
                      id={s.key}
                      type="password"
                      placeholder={s.hasValue ? "•••••••• (set)" : "Enter value"}
                      value={editValues[s.key] ?? ""}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, [s.key]: e.target.value }))
                      }
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSave(s.key)}
                      disabled={saving === s.key || !(editValues[s.key]?.trim())}
                    >
                      {saving === s.key ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
