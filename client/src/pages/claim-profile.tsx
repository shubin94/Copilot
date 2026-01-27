import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertCircle, Loader2, Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function ClaimProfile() {
  const [, params] = useRoute("/claim-profile/:id");
  const [, setLocation] = useLocation();
  const detectiveId = params?.id;

  const [formData, setFormData] = useState({
    claimantName: "",
    claimantEmail: "",
    claimantPhone: "",
    details: "",
  });

  const [documents, setDocuments] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");

  const { data: detectiveData, isLoading } = useQuery({
    queryKey: [`/api/detectives/${detectiveId}`],
    queryFn: () => api.detectives.getById(detectiveId!),
    enabled: !!detectiveId,
  });

  const detective = detectiveData?.detective;

  const submitClaim = useMutation({
    mutationFn: async (claimData: any) => {
      const response = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(claimData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit claim");
      }

      return response.json();
    },
    onSuccess: () => {
      setTimeout(() => {
        setLocation("/");
      }, 3000);
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploadError("");

    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        setUploadError("Each file must be less than 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setDocuments((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!detectiveId) return;

    submitClaim.mutate({
      detectiveId,
      claimantName: formData.claimantName,
      claimantEmail: formData.claimantEmail,
      claimantPhone: formData.claimantPhone || undefined,
      details: formData.details || undefined,
      documents: documents.length > 0 ? documents : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <div className="flex-1 container mx-auto px-6 py-12">
          <div className="max-w-2xl mx-auto space-y-6">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!detective) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Detective profile not found</AlertDescription>
          </Alert>
        </div>
        <Footer />
      </div>
    );
  }

  if (!detective.isClaimable || detective.isClaimed) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>This profile cannot be claimed</AlertDescription>
          </Alert>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold font-heading mb-2" data-testid="text-page-title">
              Claim Your Detective Profile
            </h1>
            <p className="text-gray-600">
              Submit your claim for <span className="font-semibold">{detective.businessName}</span>
            </p>
          </div>

          {submitClaim.isSuccess ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Your claim has been submitted successfully! An admin will review your request shortly.
                Redirecting to homepage...
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Claim Form</CardTitle>
                <CardDescription>
                  Fill out this form to claim ownership of this detective profile. You will be notified once your claim is reviewed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="claimantName">
                      Full Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="claimantName"
                      data-testid="input-claimant-name"
                      value={formData.claimantName}
                      onChange={(e) =>
                        setFormData({ ...formData, claimantName: e.target.value })
                      }
                      placeholder="Enter your full name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="claimantEmail">
                      Email Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="claimantEmail"
                      type="email"
                      data-testid="input-claimant-email"
                      value={formData.claimantEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, claimantEmail: e.target.value })
                      }
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="claimantPhone">Phone Number (Optional)</Label>
                    <Input
                      id="claimantPhone"
                      type="tel"
                      data-testid="input-claimant-phone"
                      value={formData.claimantPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, claimantPhone: e.target.value })
                      }
                      placeholder="+1 234 567 8900"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="details">Additional Details (Optional)</Label>
                    <Textarea
                      id="details"
                      data-testid="input-claim-details"
                      value={formData.details}
                      onChange={(e) =>
                        setFormData({ ...formData, details: e.target.value })
                      }
                      placeholder="Provide any additional information to support your claim..."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="documents">Supporting Documents (Optional)</Label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Input
                          id="documents"
                          type="file"
                          data-testid="input-claim-documents"
                          onChange={handleFileUpload}
                          accept="image/*,.pdf"
                          multiple
                          className="cursor-pointer"
                        />
                        <Upload className="h-5 w-5 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500">
                        Upload documents to verify ownership (e.g., business license, ID). Max 5MB per file.
                      </p>
                      
                      {uploadError && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{uploadError}</AlertDescription>
                        </Alert>
                      )}

                      {documents.length > 0 && (
                        <div className="space-y-2 mt-3">
                          <p className="text-sm font-medium">Uploaded Documents ({documents.length})</p>
                          <div className="space-y-2">
                            {documents.map((_, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded"
                              >
                                <span className="text-sm">Document {index + 1}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeDocument(index)}
                                  data-testid={`button-remove-document-${index}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {submitClaim.isError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {submitClaim.error instanceof Error
                          ? submitClaim.error.message
                          : "Failed to submit claim"}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams(window.location.search);
                        const serviceId = params.get("serviceId");
                        setLocation(serviceId ? `/service/${serviceId}` : "/");
                      }}
                      data-testid="button-cancel-claim"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitClaim.isPending}
                      data-testid="button-submit-claim"
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      {submitClaim.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Claim"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
