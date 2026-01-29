import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { CreditCard, Eye, EyeOff, Save, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PaymentGateway {
  id: number;
  name: string;
  display_name: string;
  is_enabled: boolean;
  is_test_mode: boolean;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export default function AdminPaymentGateways() {
  const { toast } = useToast();
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    try {
      const response = await api.get<{ gateways: PaymentGateway[] }>("/api/admin/payment-gateways");
      setGateways(response.gateways);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load payment gateways",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (gatewayId: number, key: string, value: string) => {
    setGateways((prev: PaymentGateway[]) => prev.map((gw: PaymentGateway) => {
      if (gw.id === gatewayId) {
        return {
          ...gw,
          config: { ...gw.config, [key]: value }
        };
      }
      return gw;
    }));
  };

  const handleToggleEnabled = async (gatewayId: number) => {
    try {
      const response = await api.post<{ gateway: PaymentGateway }>(
        `/api/admin/payment-gateways/${gatewayId}/toggle`
      );
      
      setGateways((prev: PaymentGateway[]) => prev.map((gw: PaymentGateway) => 
        gw.id === gatewayId ? response.gateway : gw
      ));
      
      toast({
        title: "Success",
        description: `Payment gateway ${response.gateway.is_enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle payment gateway",
        variant: "destructive",
      });
    }
  };

  const handleToggleTestMode = (gatewayId: number) => {
    setGateways((prev: PaymentGateway[]) => prev.map((gw: PaymentGateway) => {
      if (gw.id === gatewayId) {
        return { ...gw, is_test_mode: !gw.is_test_mode };
      }
      return gw;
    }));
  };

  const handleSave = async (gateway: PaymentGateway) => {
    setSaving(gateway.id);
    try {
      await api.put(`/api/admin/payment-gateways/${gateway.id}`, {
        is_enabled: gateway.is_enabled,
        is_test_mode: gateway.is_test_mode,
        config: gateway.config,
      });
      
      toast({
        title: "Success",
        description: `${gateway.display_name} settings saved successfully`,
      });
      
      await fetchGateways(); // Refresh to get updated timestamps
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save payment gateway settings",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const toggleShowSecret = (gatewayId: number) => {
    setShowSecrets((prev: Record<number, boolean>) => ({ ...prev, [gatewayId]: !prev[gatewayId] }));
  };

  const renderConfigFields = (gateway: PaymentGateway) => {
    const isSecret = (key: string) => 
      key.toLowerCase().includes('secret') || 
      key.toLowerCase().includes('key') ||
      key.toLowerCase().includes('password');

    return Object.keys(gateway.config).map(key => {
      const isSecretField = isSecret(key);
      const showValue = showSecrets[gateway.id] || !isSecretField;
      
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={`${gateway.id}-${key}`} className="capitalize">
            {key.replace(/([A-Z])/g, ' $1').trim()}
            {isSecretField && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <div className="relative">
            <Input
              id={`${gateway.id}-${key}`}
              type={showValue ? "text" : "password"}
              value={gateway.config[key] || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange(gateway.id, key, e.target.value)}
              placeholder={`Enter ${key}`}
              className="pr-10"
            />
            {isSecretField && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => toggleShowSecret(gateway.id)}
              >
                {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      );
    });
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading payment gateways...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Payment Gateway Settings</h1>
          <p className="text-gray-600">
            Configure and manage payment gateways for your platform
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Security Notice:</strong> API keys and secrets are sensitive. Only enable gateways when properly configured.
            Test mode allows you to test payments without processing real transactions.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {gateways.map((gateway: PaymentGateway) => (
            <Card key={gateway.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle>{gateway.display_name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant={gateway.is_enabled ? "default" : "secondary"}>
                          {gateway.is_enabled ? "Enabled" : "Disabled"}
                        </Badge>
                        <Badge variant={gateway.is_test_mode ? "outline" : "destructive"}>
                          {gateway.is_test_mode ? "Test Mode" : "Live Mode"}
                        </Badge>
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={gateway.is_enabled}
                    onCheckedChange={() => handleToggleEnabled(gateway.id)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Test Mode Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="space-y-0.5">
                    <Label htmlFor={`test-mode-${gateway.id}`}>Test Mode</Label>
                    <p className="text-sm text-gray-600">
                      Use test credentials for development and testing
                    </p>
                  </div>
                  <Switch
                    id={`test-mode-${gateway.id}`}
                    checked={gateway.is_test_mode}
                    onCheckedChange={() => handleToggleTestMode(gateway.id)}
                  />
                </div>

                {/* Configuration Fields */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-gray-700">API Configuration</h4>
                  {renderConfigFields(gateway)}
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={() => handleSave(gateway)}
                    disabled={saving === gateway.id}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving === gateway.id ? "Saving..." : "Save Changes"}
                  </Button>
                </div>

                {/* Last Updated */}
                <p className="text-xs text-gray-500 text-right">
                  Last updated: {new Date(gateway.updated_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
