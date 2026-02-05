/**
 * App Secrets – single source of truth for all application credentials.
 * All credentials are stored and read from the database; saving updates DB only.
 */

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, Save } from "lucide-react";
import { api } from "@/lib/api";

// Must match server SECRET_KEYS so the form always shows all fields (even if API fails or returns no keys)
const ALL_KEYS = [
  "SERVER_HOST",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "SESSION_SECRET",
  "BASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM_EMAIL",
  "SENDPULSE_API_ID",
  "SENDPULSE_API_SECRET",
  "SENDPULSE_SENDER_EMAIL",
  "SENDPULSE_SENDER_NAME",
  "SENDPULSE_ENABLED",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_MODE",
  "GEMINI_API_KEY",
];

const KEY_LABELS: Record<string, string> = {
  SERVER_HOST: "Server Host",
  GOOGLE_OAUTH_CLIENT_ID: "Google OAuth Client ID",
  GOOGLE_OAUTH_CLIENT_SECRET: "Google OAuth Client Secret",
  SESSION_SECRET: "Session Secret",
  BASE_URL: "Base URL",
  SUPABASE_URL: "Supabase URL",
  SUPABASE_SERVICE_ROLE_KEY: "Supabase Service Role Key",
  SENDGRID_API_KEY: "SendGrid API Key",
  SENDGRID_FROM_EMAIL: "SendGrid From Email",
  SMTP_HOST: "SMTP Host",
  SMTP_PORT: "SMTP Port",
  SMTP_SECURE: "SMTP Secure (true/false)",
  SMTP_USER: "SMTP User",
  SMTP_PASS: "SMTP Password",
  SMTP_FROM_EMAIL: "SMTP From Email",
  SENDPULSE_API_ID: "SendPulse API ID",
  SENDPULSE_API_SECRET: "SendPulse API Secret",
  SENDPULSE_SENDER_EMAIL: "SendPulse Sender Email",
  SENDPULSE_SENDER_NAME: "SendPulse Sender Name",
  SENDPULSE_ENABLED: "SendPulse Enabled (true/false)",
  RAZORPAY_KEY_ID: "Razorpay Key ID",
  RAZORPAY_KEY_SECRET: "Razorpay Key Secret",
  PAYPAL_CLIENT_ID: "PayPal Client ID",
  PAYPAL_CLIENT_SECRET: "PayPal Client Secret",
  PAYPAL_MODE: "PayPal Mode (sandbox/live)",
  GEMINI_API_KEY: "Gemini API Key",
};

function isSensitive(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.includes("secret") || lower.includes("key") || lower.includes("pass") || lower.includes("token") || lower.includes("oauth");
}

export default function AdminAppSecrets() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<string[]>(ALL_KEYS);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadSecrets();
  }, []);

  const loadSecrets = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await api.get<{ keys?: string[]; secrets?: Record<string, string> }>("/api/admin/app-secrets");
      setKeys(Array.isArray(res.keys) && res.keys.length > 0 ? res.keys : ALL_KEYS);
      setSecrets(res.secrets || {});
    } catch (err: any) {
      setLoadError(true);
      setKeys(ALL_KEYS);
      setSecrets({});
      const msg = err?.message || "Log in as admin to load and save credentials.";
      toast({
        title: "Could not load saved values",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string) => {
    const value = secrets[key] ?? "";
    try {
      setSaving(key);
      await api.put(`/api/admin/app-secrets/${key}`, { value });
      toast({ title: "Saved", description: `${KEY_LABELS[key] || key} saved to database.` });
      await loadSecrets();
    } catch (err: any) {
      const msg = err?.message || err?.details || `Failed to save ${KEY_LABELS[key] || key}`;
      toast({
        title: "Save failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const toggleVisible = (key: string) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="h-8 w-8" />
            App Secrets
          </h1>
          <p className="text-muted-foreground mt-1">
            Single source of truth for all application credentials. Values are stored in the database and used at runtime. Sensitive fields are masked.
          </p>
        </div>

        {loading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Credentials</CardTitle>
              <CardDescription>
              Edit and save each value. Each Save writes to the database (app_secrets table). Those exact values are what the app uses at runtime (session, email, payments, Supabase, etc.). Use the eye icon to show or hide sensitive values.
            </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadError && (
                <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 px-3 py-2 rounded-md">
                  You must be logged in as an admin to load existing values and to save. Fields below can still be edited and saved once you are admin.
                </p>
              )}
              {!loadError && keys.length > 0 && !keys.some((k) => (secrets[k] ?? "").trim() !== "") && (
                <div className="text-sm text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 px-4 py-3 rounded-md border border-blue-200 dark:border-blue-800">
                  <strong>Why is everything empty?</strong> Nothing has been saved to the database yet. If your app works today, it’s using environment variables (e.g. from <code className="bg-black/10 dark:bg-black/30 px-1 rounded">.env</code>). To store credentials here: paste each value into the field (from your <code className="bg-black/10 dark:bg-black/30 px-1 rounded">.env</code> or wherever you keep them), then click <strong>Save</strong> for that row. Once saved, the app will use these database values.
                </div>
              )}
              {keys.map((key) => {
                const label = KEY_LABELS[key] || key;
                const mask = isSensitive(key);
                const isVisible = !!visible[key];
                const value = secrets[key] ?? "";
                return (
                  <div key={key} className="flex flex-col gap-2">
                    <Label htmlFor={key}>{label}</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1 min-w-0">
                        <Input
                          id={key}
                          type={mask && !isVisible ? "password" : "text"}
                          value={value}
                          onChange={(e) => setSecrets((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={mask ? "••••••••" : ""}
                          className={mask ? "pr-10" : ""}
                          autoComplete="off"
                          aria-label={label}
                        />
                        {mask && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 z-10 shrink-0"
                            aria-label={isVisible ? "Hide value" : "Show value"}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleVisible(key);
                            }}
                          >
                            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                      <Button onClick={() => handleSave(key)} disabled={saving === key}>
                        {saving === key ? "Saving..." : <><Save className="h-4 w-4 mr-1" /> Save</>}
                      </Button>
                    </div>
                    {mask && isVisible && (
                      <div className="text-sm font-mono bg-muted/50 border border-border rounded-md px-3 py-2 break-all" role="textbox" aria-label={`Revealed value for ${label}`}>
                        {value || "(empty)"}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
