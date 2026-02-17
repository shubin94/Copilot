import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Lock, Save, AlertCircle, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/user-context";
import { useLocation } from "wouter";

interface SecretItem {
  key: string;
  value: string;
  hasValue: boolean;
}

// Infrastructure secrets that must NEVER be exposed or editable via UI
const INFRASTRUCTURE_SECRETS = [
  "DATABASE_URL",
  "supabase_url",
  "supabase_service_role_key",
];

// High-risk authentication keys that require explicit confirmation
const HIGH_RISK_KEYS = [
  "session_secret",
  "base_url",
  "host",
  "csrf_allowed_origins",
];

const HIGH_RISK_WARNINGS: Record<string, string> = {
  session_secret: "All users will be logged out after server restart.",
  base_url: "OAuth redirects and email links will use the new URL.",
  host: "Server binding address will change. May become unreachable if incorrect.",
  csrf_allowed_origins: "API requests from removed origins will be blocked.",
};

const KEY_LABELS: Record<string, string> = {
  host: "Server Host",
  google_client_id: "Google OAuth Client ID",
  google_client_secret: "Google OAuth Client Secret",
  session_secret: "Session Secret",
  base_url: "Base URL",
  csrf_allowed_origins: "CSRF Allowed Origins",
  // Supabase credentials removed - must be set via environment variables only
  smtp_host: "SMTP Host",
  smtp_port: "SMTP Port",
  smtp_secure: "SMTP Secure",
  smtp_user: "SMTP User",
  smtp_pass: "SMTP Password",
  smtp_from_email: "SMTP From Email",
  razorpay_key_id: "Razorpay Key ID",
  razorpay_key_secret: "Razorpay Key Secret",
  paypal_client_id: "PayPal Client ID",
  paypal_client_secret: "PayPal Client Secret",
  paypal_mode: "PayPal Mode",
  gemini_api_key: "Gemini API Key",
  deepseek_api_key: "DeepSeek API Key (for Smart Search)",
};
type SecretGroup = {
  id: string;
  title: string;
  description?: string;
  keys: string[];
};

const SECRET_GROUPS: SecretGroup[] = [
  {
    id: "auth",
    title: "Login & Core Auth",
    description: "Session, base URL, CSRF, and OAuth settings.",
    keys: [
      "session_secret",
      "base_url",
      "host",
      "csrf_allowed_origins",
      "google_client_id",
      "google_client_secret",
    ],
  },
  {
    id: "email",
    title: "Email",
    description: "SMTP and email provider credentials.",
    keys: [
      "smtp_host",
      "smtp_port",
      "smtp_secure",
      "smtp_user",
      "smtp_pass",
      "smtp_from_email",
    ],
  },
  {
    id: "payments",
    title: "Payments",
    description: "Payment gateway credentials.",
    keys: [
      "razorpay_key_id",
      "razorpay_key_secret",
      "paypal_client_id",
      "paypal_client_secret",
      "paypal_mode",
    ],
  },
  {
    id: "ai",
    title: "AI & Search",
    description: "AI features and search integrations.",
    keys: [
      "gemini_api_key",
      "deepseek_api_key",
    ],
  },
];

export default function AdminAppSecrets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();
  const [, setLocation] = useLocation();
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoadingUser && (!isAuthenticated || user?.role !== "admin")) {
      setLocation("/login");
    }
  }, [isAuthenticated, user, isLoadingUser, setLocation]);

  useEffect(() => {
    // Force fresh auth check to ensure we're using the current admin account
    // This prevents showing stale cached user data from a different session
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    // Only fetch secrets if user is authenticated and admin
    if (isAuthenticated && user?.role === "admin") {
      fetchSecrets();
    }
  }, [queryClient, isAuthenticated, user]);

  const fetchSecrets = async () => {
    try {
      const response = await api.get<{ secrets: SecretItem[] }>("/api/admin/app-secrets");
      // Filter out infrastructure secrets from display (defensive)
      const filteredSecrets = response.secrets.filter(s => !INFRASTRUCTURE_SECRETS.includes(s.key));
      setSecrets(filteredSecrets);
      const initial: Record<string, string> = {};
      filteredSecrets.forEach((s) => { initial[s.key] = ""; });
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
    // Require explicit confirmation for high-risk keys
    if (HIGH_RISK_KEYS.includes(key) && !confirmations[key]) {
      toast({ 
        title: "Confirmation Required", 
        description: "Please check the confirmation box to proceed.", 
        variant: "destructive" 
      });
      return;
    }
    setSaving(key);
    try {
      await api.put(`/api/admin/app-secrets/${key}`, { value });
      toast({ title: "Success", description: "Secret saved. Restart server to apply." });
      setEditValues((prev) => ({ ...prev, [key]: "" }));
      setConfirmations((prev) => ({ ...prev, [key]: false }));
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

  const secretsByKey = new Map(secrets.map((s) => [s.key, s]));
  const usedKeys = new Set<string>();
  const groupedSecrets = SECRET_GROUPS.map((group) => {
    const items = group.keys
      .map((key) => secretsByKey.get(key))
      .filter((item): item is SecretItem => Boolean(item));
    items.forEach((item) => usedKeys.add(item.key));
    return { ...group, items };
  });
  const otherItems = secrets.filter((s) => !usedKeys.has(s.key));

  if (otherItems.length) {
    groupedSecrets.push({
      id: "other",
      title: "Other",
      description: "Additional app secrets.",
      keys: [],
      items: otherItems,
    } as SecretGroup & { items: SecretItem[] });
  }

  const renderSecret = (s: SecretItem) => {
    const isHighRisk = HIGH_RISK_KEYS.includes(s.key);
    return (
      <div key={s.key} className="flex flex-col gap-2 pb-4 border-b last:border-b-0">
        <Label htmlFor={s.key}>{KEY_LABELS[s.key] || s.key}</Label>

        {isHighRisk && (
          <Alert variant="destructive" className="mb-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> Changing this may log out users or break authentication. {HIGH_RISK_WARNINGS[s.key]}
            </AlertDescription>
          </Alert>
        )}

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

        {isHighRisk && editValues[s.key]?.trim() && (
          <div className="flex items-center space-x-2 mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <Checkbox
              id={`confirm-${s.key}`}
              checked={!!confirmations[s.key]}
              onCheckedChange={(checked) =>
                setConfirmations((prev) => ({ ...prev, [s.key]: Boolean(checked) }))
              }
            />
            <Label
              htmlFor={`confirm-${s.key}`}
              className="text-sm font-medium cursor-pointer"
            >
              I understand this change will affect authentication and require server restart
            </Label>
          </div>
        )}
      </div>
    );
  };

  // Show loading state while checking authentication
  if (isLoadingUser) {
    return null;
  }

  // Don't render anything if not authenticated or not admin (will redirect)
  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="p-6">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="p-6 max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              App Secrets (Auth & API)
            </CardTitle>
            <CardDescription>
              Store Google OAuth, email, and payment credentials in the database. 
              DATABASE_URL and Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) must be set via environment variables only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Values are masked. Enter a new value and click Save to update.
              </AlertDescription>
            </Alert>

            <Alert variant="default" className="mb-4 border-yellow-500 bg-yellow-50 text-yellow-900">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Changes take effect only after server restart.
              </AlertDescription>
            </Alert>

            <div className="space-y-10">
              {groupedSecrets
                .filter((group) => group.items && group.items.length > 0)
                .map((group) => (
                  <div key={group.id} className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">{group.title}</h3>
                      {group.description && (
                        <p className="text-sm text-muted-foreground">{group.description}</p>
                      )}
                    </div>
                    <div className="space-y-6">
                      {group.items.map(renderSecret)}
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
