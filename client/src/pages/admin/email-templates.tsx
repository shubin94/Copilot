import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Mail, Edit2, Eye, EyeOff, Save, X, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  body: string;
  sendpulseTemplateId: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplateDetails {
  template: EmailTemplate;
  variables: string[];
}

export default function AdminEmailTemplates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDetails | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    subject: "",
    body: "",
    sendpulseTemplateId: "",
  });

  // Load all templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<{ templates: EmailTemplate[] }>("/api/admin/email-templates");
      console.log("[Email Templates] API Response:", response);
      console.log("[Email Templates] Templates array:", response.templates);
      setTemplates(response.templates || []);
    } catch (error) {
      console.error("[Email Templates] Load error:", error);
      toast({
        title: "Error",
        description: "Failed to load email templates",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTemplate = async (template: EmailTemplate) => {
    try {
      const response = await api.get<{ template: EmailTemplate; variables: string[] }>(`/api/admin/email-templates/${template.key}`);
      setSelectedTemplate(response);
      setEditForm({
        name: response.template.name || "",
        subject: response.template.subject || "",
        body: response.template.body || "",
        sendpulseTemplateId: response.template.sendpulseTemplateId?.toString() || "",
      });
      setIsEditModalOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load template details",
        variant: "destructive",
      });
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      setIsSaving(true);
      await api.put<{ success: boolean; template: EmailTemplate; variables: string[] }>(`/api/admin/email-templates/${selectedTemplate.template.key}`, {
        name: editForm.name,
        subject: editForm.subject,
        body: editForm.body,
        sendpulseTemplateId: editForm.sendpulseTemplateId || null,
      });

      toast({
        title: "Success",
        description: "Email template updated successfully",
      });

      // Reload templates
      loadTemplates();
      setIsEditModalOpen(false);
      setSelectedTemplate(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (template: EmailTemplate) => {
    try {
      await api.post<{ success: boolean; template: EmailTemplate }>(`/api/admin/email-templates/${template.key}/toggle`);

      toast({
        title: "Success",
        description: `Template ${template.isActive ? "disabled" : "enabled"}`,
      });

      // Update local state
      setTemplates(
        templates.map((t: EmailTemplate) =>
          t.key === template.key ? { ...t, isActive: !t.isActive } : t
        )
      );
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle template status",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Email Templates</h1>
              <p className="text-gray-600">Manage all email templates sent from the platform</p>
            </div>
          </div>
        </div>

        {/* Templates Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Email Templates</CardTitle>
            <CardDescription>
              Click on any template to view and edit its content
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading templates...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No email templates yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template Name</TableHead>
                      <TableHead>Template Key</TableHead>
                      <TableHead>SendPulse ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template: EmailTemplate) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell className="font-mono text-sm text-gray-600">
                          {template.key}
                        </TableCell>
                        <TableCell>
                          {template.sendpulseTemplateId ? (
                            <Badge variant="outline">{template.sendpulseTemplateId}</Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={template.isActive ? "default" : "secondary"}>
                            {template.isActive ? "Active" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatDate(template.updatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewTemplate(template)}
                            >
                              <Edit2 className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant={template.isActive ? "outline" : "secondary"}
                              size="sm"
                              onClick={() => handleToggleStatus(template)}
                            >
                              {template.isActive ? (
                                <>
                                  <Eye className="w-4 h-4 mr-1" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-4 h-4 mr-1" />
                                  Disabled
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Email Template</DialogTitle>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-6">
              {/* Template Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Template Key</p>
                    <p className="font-mono text-sm font-semibold">
                      {selectedTemplate.template.key}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-semibold">
                      <Badge variant={selectedTemplate.template.isActive ? "default" : "secondary"}>
                        {selectedTemplate.template.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </p>
                  </div>
                </div>
              </div>

              {/* Variables List */}
              {selectedTemplate.variables.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Available Variables</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.variables.map((variable) => (
                      <Badge key={variable} variant="outline">
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit Fields */}
              <div className="space-y-4">
                {/* Template Name */}
                <div>
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                  />
                </div>

                {/* Subject */}
                <div>
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    value={editForm.subject}
                    onChange={(e) =>
                      setEditForm({ ...editForm, subject: e.target.value })
                    }
                  />
                </div>

                {/* SendPulse Template ID */}
                <div>
                  <Label htmlFor="sendpulseId">SendPulse Template ID (Optional)</Label>
                  <Input
                    id="sendpulseId"
                    type="number"
                    value={editForm.sendpulseTemplateId}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        sendpulseTemplateId: e.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The ID of the SendPulse template to link to this email
                  </p>
                </div>

                {/* Body */}
                <div>
                  <Label htmlFor="body">Email Body (HTML)</Label>
                  <Textarea
                    id="body"
                    value={editForm.body}
                    onChange={(e) =>
                      setEditForm({ ...editForm, body: e.target.value })
                    }
                    className="font-mono text-sm min-h-[400px]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {`{{variableName}}`} for template variables
                  </p>
                </div>
              </div>

              {/* Save Actions */}
              <DialogFooter className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSaving}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTemplate}
                  disabled={isSaving || !editForm.subject || !editForm.body}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
