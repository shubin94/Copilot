import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Bell, Lock, Mail, Phone, MessageCircle } from "lucide-react";
import { useCurrentDetective } from "@/lib/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

export default function DetectiveSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();
  const { data: currentDetectiveData } = useCurrentDetective();
  const detective = currentDetectiveData?.detective;
  const queryClient = useQueryClient();
  const [contactEmail, setContactEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const updateDetectiveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.detectives.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["detectives", "current"] });
      toast({ title: "Saved", description: "Contact information updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed", description: error.message || "Error updating contact info", variant: "destructive" });
    }
  });

  useEffect(() => {
    if (!detective) return;
    const defaultEmail = ((detective as any).contactEmail as string) || ((detective as any).email as string) || "";
    setContactEmail(defaultEmail);
    setPhoneNumber(detective.phone || "");
    setWhatsappNumber(detective.whatsapp || "");
  }, [detective]);

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Missing fields", description: "Fill all password fields", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Weak password", description: "Use at least 8 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      toast({ title: "Password updated", description: "Your password has been changed" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({ title: "Failed to update", description: error.message || "Error updating password", variant: "destructive" });
    }
  };
  return (
    <DashboardLayout role="detective">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-3xl font-bold font-heading text-gray-900">Account Settings</h2>
          <p className="text-gray-500">Manage your account preferences and security.</p>
        </div>

        <div className="space-y-6">
          {/* Notifications */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-gray-500" />
                <CardTitle>Notifications</CardTitle>
              </div>
              <CardDescription>Choose how you want to be notified about new orders and messages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Email Notifications</Label>
                  <p className="text-sm text-gray-500">Receive emails about new orders and messages.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">SMS Notifications</Label>
                  <p className="text-sm text-gray-500">Receive text messages for urgent updates.</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Marketing Emails</Label>
                  <p className="text-sm text-gray-500">Receive updates about new features and promotions.</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-gray-500" />
                <CardTitle>Security</CardTitle>
              </div>
              <CardDescription>Update your password and security settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <Button className="w-fit bg-green-600 hover:bg-green-700" onClick={handleUpdatePassword}>Update Password</Button>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-gray-500" />
                <CardTitle>Contact Information</CardTitle>
              </div>
              <CardDescription>Manage your public contact details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input id="phone" className="pl-9" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <div className="relative">
                    <MessageCircle className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input id="whatsapp" className="pl-9" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input id="email" className="pl-9" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                  </div>
                </div>
              </div>
              <Button 
                variant="outline"
                onClick={() => {
                  if (!detective) return;
                  updateDetectiveMutation.mutate({ id: detective.id, data: { contactEmail: contactEmail || undefined, phone: phoneNumber || undefined, whatsapp: whatsappNumber || undefined } });
                }}
              >
                Save Contact Info
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="destructive" className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" disabled title="Not available yet">Delete Account</Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
