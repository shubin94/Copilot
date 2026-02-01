import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, FileText, Download, Shield, User, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { Link, useRoute, useLocation } from "wouter";
import { useApplication, useUpdateApplicationNotes, useUpdateApplicationStatus } from "@/lib/hooks";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function AdminSignupDetails() {
  const [match, params] = useRoute("/admin/signups/:id");
  const id = params?.id || null;
  const [, setLocation] = useLocation();
  const { data, isLoading } = useApplication(id);
  const application = data?.application;
  const updateNotes = useUpdateApplicationNotes();
  const updateStatus = useUpdateApplicationStatus();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const displayDocName = (doc: string, idx: number) => {
    if (!doc) return `Document ${idx + 1}`;
    if (doc.startsWith("data:")) return `Document ${idx + 1}`;
    try {
      const u = new URL(doc);
      const base = u.pathname.split("/").pop() || u.hostname;
      return base.length > 30 ? base.slice(0, 30) + "…" : base;
    } catch {
      const base = (doc.split("/").pop() || `Document ${idx + 1}`);
      return base.length > 30 ? base.slice(0, 30) + "…" : base;
    }
  };

  useEffect(() => {
    setNotes(application?.reviewNotes || "");
  }, [application?.reviewNotes]);

  return (
    <DashboardLayout role="admin">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link href="/admin/signups">
                <a className="text-sm text-gray-500 hover:text-gray-900 hover:underline">← Back to Signups</a>
              </Link>
            </div>
            <h2 className="text-3xl font-bold font-heading text-gray-900">Application #{application?.id || id}</h2>
            {application && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>Applied on {format(new Date(application.createdAt), "MMM dd, yyyy")}</span>
                <span>•</span>
                <Badge className={application.status === "pending" ? "bg-yellow-100 text-yellow-700" : application.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{application.status}</Badge>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="destructive"
              className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
              onClick={() => setRejectDialogOpen(true)}
              disabled={!application || application.status === "approved" || application.status === "rejected" || updateStatus.isPending}
            >
              <X className="mr-2 h-4 w-4" /> Reject Application
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={async () => {
                if (!id) return;
                try {
                  await updateStatus.mutateAsync({ id, status: "approved" });
                  toast({ title: "Application Approved", description: `${application?.fullName || "Applicant"} has been approved and added to the platform.` });
                  setLocation("/admin/signups");
                } catch (err: any) {
                  toast({ title: "Error", description: err?.message || "Failed to approve application. Please try again.", variant: "destructive" });
                }
              }}
              disabled={!application || application.status === "approved" || application.status === "rejected" || updateStatus.isPending}
            >
              <Check className="mr-2 h-4 w-4" /> Approve Detective
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Applicant Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-gray-500" />
                  Applicant Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {application?.logo && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-gray-500">Profile Photo / Logo</span>
                    <div className="flex items-center gap-4">
                      <a href={application.logo} target="_blank" rel="noopener noreferrer" title="Open full size">
                        <img src={application.logo} alt="Logo" className="w-20 h-20 rounded-full object-cover border hover:opacity-90" />
                      </a>
                      <Badge variant="secondary" className="capitalize">{application.businessType}</Badge>
                      <a href={application.logo} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">Preview</Button>
                      </a>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-gray-500">Full Name</span>
                    <p className="font-bold text-gray-900">{application?.fullName || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-gray-500">Type</span>
                    <p className="font-bold text-gray-900 capitalize">{application?.businessType || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-gray-500">Email Address</span>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <p className="text-gray-900">{application?.email || "-"}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-gray-500">Phone Number</span>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <p className="text-gray-900">{application?.phoneCountryCode && application?.phoneNumber ? `${application.phoneCountryCode} ${application.phoneNumber}` : "-"}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-gray-500">Country</span>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <p className="text-gray-900">{application?.country || "-"}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-gray-500">State</span>
                    <p className="text-gray-900">{application?.state || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-gray-500">City</span>
                    <p className="text-gray-900">{application?.city || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-gray-500">Full Address</span>
                    <p className="text-gray-900">{(application as any)?.fullAddress || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-gray-500">Pincode</span>
                    <p className="text-gray-900">{(application as any)?.pincode || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-gray-500">Years of Experience</span>
                    <p className="text-gray-900">{application?.yearsExperience || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-gray-500">License Number</span>
                    <p className="text-gray-900">{(application as any)?.licenseNumber || '-'}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <span className="text-sm font-medium text-gray-500">Professional Bio</span>
                  <p className="text-gray-700 leading-relaxed">{application?.about || "-"}</p>
                </div>

                <div className="space-y-2">
                   <span className="text-sm font-medium text-gray-500">Selected Categories</span>
                   <div className="flex flex-wrap gap-2">
                     {(application?.serviceCategories || []).length > 0 ? (
                       application!.serviceCategories!.map((cat, idx) => (
                         <Badge key={idx} variant="secondary">{cat}</Badge>
                       ))
                     ) : (
                       <span className="text-sm text-gray-400">No categories</span>
                     )}
                   </div>
                </div>

                {/* Company Information (Agency only) */}
                {application?.businessType === 'agency' && (
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-gray-500">Company Name</span>
                      <p className="font-bold text-gray-900">{application?.companyName || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-gray-500">Website</span>
                      {application?.businessWebsite ? (
                        <a href={application.businessWebsite} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{application.businessWebsite}</a>
                      ) : (
                        <p className="text-gray-900">-</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-gray-500" />
                  Verification Documents
                </CardTitle>
                <CardDescription>Review the uploaded documents for authenticity.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {(application?.businessType === 'agency' ? application?.businessDocuments : (application as any)?.documents) && ((application?.businessType === 'agency' ? application?.businessDocuments : (application as any)?.documents)!.length > 0) ? (
                  ((application?.businessType === 'agency' ? application?.businessDocuments : (application as any)?.documents) as string[])!.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-white rounded-lg border flex items-center justify-center">
                          <FileText className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-gray-900 max-w-[220px] truncate">{displayDocName(doc, idx)}</p>
                        </div>
                      </div>
                      <a href={doc} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> View</Button>
                      </a>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500">No documents provided</div>
                )}
                <div className="text-xs text-gray-500">
                  {application?.businessType === 'agency' ? 'Business Supporting Documents' : 'Government ID Documents'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Admin Notes & Checklist */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review Checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <input type="checkbox" id="check1" className="mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  <label htmlFor="check1" className="text-sm text-gray-700 leading-tight">Verify PI License number with state database</label>
                </div>
                <div className="flex items-start space-x-3">
                  <input type="checkbox" id="check2" className="mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  <label htmlFor="check2" className="text-sm text-gray-700 leading-tight">Check ID expiration date</label>
                </div>
                <div className="flex items-start space-x-3">
                  <input type="checkbox" id="check3" className="mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  <label htmlFor="check3" className="text-sm text-gray-700 leading-tight">Confirm no criminal record matches</label>
                </div>
                <div className="flex items-start space-x-3">
                  <input type="checkbox" id="check4" className="mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  <label htmlFor="check4" className="text-sm text-gray-700 leading-tight">Validate phone number and email</label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Internal Notes</CardTitle>
                <CardDescription>Private notes for admin team.</CardDescription>
              </CardHeader>
              <CardContent>
                <textarea 
                  className="w-full min-h-[150px] p-3 border rounded-md text-sm bg-gray-50 focus:bg-white transition-colors outline-none border-gray-200 focus:border-gray-400"
                  placeholder="Add notes about this application..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                ></textarea>
                {Array.isArray((application as any)?.categoryPricing) ? (
                  <div className="mt-4 space-y-2">
                    <span className="text-sm font-medium text-gray-500">Category Pricing</span>
                    <div className="space-y-1">
                      {(((application as any).categoryPricing as Array<{category: string; price: string; currency: string}>) || []).map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span>{p.category}</span>
                          <span className="font-bold">{p.currency} {p.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-2 w-full"
                  onClick={async () => {
                    if (!id) return;
                    try {
                      await updateNotes.mutateAsync({ id, reviewNotes: notes.trim() });
                      toast({ title: "Notes Saved", description: "Internal notes have been updated." });
                    } catch (err: any) {
                      toast({ title: "Error", description: err?.message || "Failed to save notes", variant: "destructive" });
                    }
                  }}
                  disabled={updateNotes.isPending}
                >
                  Save Note
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>Enter the internal reason for rejection. This note is visible only to the admin team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {application && <div className="text-sm text-gray-700">{application.fullName}</div>}
            <Textarea placeholder="Reason for rejection" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!id) return;
                try {
                  await updateStatus.mutateAsync({ id, status: "rejected", reviewNotes: rejectReason.trim() || undefined });
                  setRejectDialogOpen(false);
                  toast({ title: "Application Rejected", description: `${application?.fullName || "Applicant"}'s application has been rejected.` });
                  setLocation("/admin/signups");
                } catch (err: any) {
                  toast({ title: "Error", description: err?.message || "Failed to reject application. Please try again.", variant: "destructive" });
                }
              }}
              disabled={updateStatus.isPending}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
