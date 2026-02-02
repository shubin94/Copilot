import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, ShieldAlert, Inbox } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useClaims, useUpdateClaimStatus, useDetective } from "@/lib/hooks";
import { format } from "date-fns";

function ClaimItem({ claim }: { claim: any }) {
  const { data: detectiveData } = useDetective(claim.detectiveId);
  const detective = detectiveData?.detective;
  const updateStatus = useUpdateClaimStatus();
  const { toast } = useToast();
  const [showDetails, setShowDetails] = useState(false);

  const handleApprove = async () => {
    try {
      await updateStatus.mutateAsync({ id: claim.id, status: "approved" });
      toast({
        title: "Claim Approved",
        description: `${claim.claimantName} can now manage this detective profile.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to approve claim. Please try again.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    try {
      await updateStatus.mutateAsync({ id: claim.id, status: "rejected" });
      toast({
        title: "Claim Rejected",
        description: `${claim.claimantName}'s claim has been rejected.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reject claim. Please try again.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  if (!detective) {
    return (
      <div className="p-4 border border-gray-100 rounded-lg bg-gray-50/50">
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-gray-100 rounded-lg bg-gray-50/50 gap-4" data-testid={`claim-${claim.id}`}>
      <div className="flex items-center space-x-4 flex-1">
        <Avatar className="h-12 w-12">
          <AvatarFallback>{detective.businessName?.[0] || "D"}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900">{detective.businessName}</h3>
            {!detective.isClaimed && (
              <Badge variant="outline" className="text-[10px]">Unclaimed</Badge>
            )}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Claimed by:{" "}
            <button
              type="button"
              className="font-medium text-blue-600 hover:underline"
              onClick={() => setShowDetails((v) => !v)}
            >
              {claim.claimantName}
            </button>{" "}
            ({claim.claimantEmail})
          </div>
          {claim.claimantPhone && (
            <div className="text-xs text-gray-500">{claim.claimantPhone}</div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            Submitted {format(new Date(claim.createdAt), "MMM dd, yyyy")}
          </div>
          {showDetails && (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-gray-700 bg-white p-2 rounded border border-gray-200">
                <div><span className="font-semibold">Full Name:</span> {claim.claimantName}</div>
                <div><span className="font-semibold">Email:</span> {claim.claimantEmail}</div>
                {claim.claimantPhone && (
                  <div><span className="font-semibold">Phone:</span> {claim.claimantPhone}</div>
                )}
              </div>
              {claim.details && (
                <div className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-1">Details</div>
                  {claim.details}
                </div>
              )}
              {Array.isArray(claim.documents) && claim.documents.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Uploaded Documents</div>
                  <div className="flex flex-wrap gap-2">
                    {claim.documents.map((doc: string, idx: number) => (
                      <a
                        key={`${claim.id}-doc-${idx}`}
                        href={doc}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 underline bg-white px-2 py-1 rounded border border-gray-200"
                      >
                        Document {idx + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 w-full md:w-auto">
        <Button 
          onClick={handleApprove}
          className="bg-green-600 hover:bg-green-700 flex-1 md:flex-none" 
          size="sm"
          disabled={updateStatus.isPending}
          data-testid={`button-approve-${claim.id}`}
        >
          <CheckCircle className="h-4 w-4 mr-2" /> Approve
        </Button>
        <Button 
          onClick={handleReject}
          variant="destructive" 
          size="sm"
          className="flex-1 md:flex-none"
          disabled={updateStatus.isPending}
          data-testid={`button-reject-${claim.id}`}
        >
          <XCircle className="h-4 w-4 mr-2" /> Reject
        </Button>
      </div>
    </div>
  );
}

export default function AdminClaims() {
  const pageSize = 10;
  const { data, isLoading, isError } = useClaims("pending", 200);
  const claims = data?.claims || [];
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(claims.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageItems = claims.slice(start, start + pageSize);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold font-heading text-gray-900">Profile Claims</h2>
          <p className="text-gray-500">Review and approve ownership claims for existing detective profiles.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending Claims</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : claims.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Inbox className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No claims yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pageItems.map((claim) => (
                  <ClaimItem key={claim.id} claim={claim} />
                ))}
                <div className="flex items-center justify-between pt-4">
                  <span className="text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
