import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface VisibilityRecord {
  detectiveId: string;
  isVisible: boolean;
  isFeatured: boolean;
  manualRank: number | null;
  visibilityScore: number;
  detective: {
    id: string;
    businessName: string;
    email: string;
    subscriptionPackageId: string | null;
    hasBlueTick: boolean;
    status: string;
  } | null;
}

export default function RankingVisibilityPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<VisibilityRecord>>>({});

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await fetch("/api/admin/visibility");
        if (response.status === 401 || response.status === 403) {
          navigate("/");
          toast({
            title: "Access Denied",
            description: "Admin access required",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      }
    };
    checkAdmin();
  }, [navigate, toast]);

  // Fetch visibility records
  const { data, isLoading, error, refetch } = useQuery<{ visibility: VisibilityRecord[] }>({
    queryKey: ["visibility-records"],
    queryFn: async () => {
      const response = await fetch("/api/admin/visibility");
      if (!response.ok) throw new Error("Failed to fetch visibility records");
      return response.json();
    },
  });

  // Mutation to update visibility
  const updateMutation = useMutation({
    mutationFn: async (variables: {
      detectiveId: string;
      updates: Partial<VisibilityRecord>;
    }) => {
      const response = await fetch(`/api/admin/visibility/${variables.detectiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variables.updates),
      });
      if (!response.ok) throw new Error("Failed to update visibility");
      return response.json();
    },
    onSuccess: () => {
      refetch();
      setEditingId(null);
      setEdits({});
      toast({
        title: "Success",
        description: "Visibility settings updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update visibility",
        variant: "destructive",
      });
    },
  });

  const handleSave = (detectiveId: string) => {
    const updates = edits[detectiveId];
    if (updates) {
      updateMutation.mutate({ detectiveId, updates });
    }
  };

  const handleToggle = (detectiveId: string, field: "isVisible" | "isFeatured") => {
    setEdits((prev: any) => ({
      ...prev,
      [detectiveId]: {
        ...prev[detectiveId],
        [field]: !prev[detectiveId]?.[field],
      },
    }));
  };

  const handleManualRankChange = (detectiveId: string, value: string) => {
    setEdits((prev: any) => ({
      ...prev,
      [detectiveId]: {
        ...prev[detectiveId],
        manualRank: value === "" ? null : parseInt(value, 10),
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">
              Error loading visibility records: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const visibility = data?.visibility || [];

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Ranking & Visibility Management</h1>
        <p className="text-gray-600 mt-2">
          Control detective visibility and ranking across the platform
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detective Visibility Settings</CardTitle>
          <CardDescription>
            Control visibility status, featured placement, and manual ranking for each detective
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Visible</TableHead>
                  <TableHead className="text-center">Featured</TableHead>
                  <TableHead>Manual Rank</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibility.map((record) => {
                  const isEditing = editingId === record.detectiveId;
                  const currentEdit = edits[record.detectiveId] || record;

                  return (
                    <TableRow key={record.detectiveId}>
                      <TableCell className="font-medium">
                        {record.detective?.businessName || "Unknown"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {record.detective?.email || "N/A"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {record.detective?.status || "inactive"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          {isEditing ? (
                            <input
                              type="checkbox"
                              checked={currentEdit.isVisible ?? record.isVisible}
                              onChange={() => handleToggle(record.detectiveId, "isVisible")}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={record.isVisible}
                              disabled
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          {isEditing ? (
                            <input
                              type="checkbox"
                              checked={currentEdit.isFeatured ?? record.isFeatured}
                              onChange={() => handleToggle(record.detectiveId, "isFeatured")}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={record.isFeatured}
                              disabled
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            max="1000"
                            placeholder="Leave empty for none"
                            value={currentEdit.manualRank ?? ""}
                            onChange={(e: any) =>
                              handleManualRankChange(record.detectiveId, e.target.value)
                            }
                            className="w-24"
                          />
                        ) : (
                          <span className="text-sm">
                            {record.manualRank !== null ? record.manualRank : "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold text-blue-600">
                          {record.visibilityScore.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleSave(record.detectiveId)}
                              disabled={updateMutation.isPending}
                            >
                              {updateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(null);
                                setEdits((prev: any) => {
                                  const { [record.detectiveId]: _, ...rest } = prev;
                                  return rest;
                                });
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(record.detectiveId);
                              setEdits((prev: any) => ({
                                ...prev,
                                [record.detectiveId]: {
                                  isVisible: record.isVisible,
                                  isFeatured: record.isFeatured,
                                  manualRank: record.manualRank,
                                },
                              }));
                            }}
                          >
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {visibility.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No detective records found</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg">Ranking Algorithm - LEVELS + BADGES + ACTIVITY + REVIEWS</CardTitle>
          <CardDescription className="mt-2">
            Formula: visibilityScore = manual + level + badges + activity + reviews
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-4">
          <div>
            <p className="font-semibold text-gray-900 mb-2">1️⃣ Manual Override (0-1000 points) - HIGHEST PRIORITY</p>
            <p className="ml-4">Admin-controlled visibility score. When set, overrides all other factors completely.</p>
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-2">2️⃣ Level Score (Exactly ONE applies per detective)</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Level 1 → +100 points</li>
              <li>Level 2 → +200 points</li>
              <li>Level 3 → +300 points</li>
              <li>Pro Level → +500 points</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-2">3️⃣ Badge Score (Additive - All applicable badges stack)</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Blue Tick → +100 points (active pro/agency subscription)</li>
              <li>Pro Badge → +200 points (active subscription package)</li>
              <li>Recommended Badge → +300 points (future enhancement)</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-2">4️⃣ Activity Score (0-100 points, time-based decay)</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Active &lt;1 day → 100 points</li>
              <li>Active &lt;7 days → 75 points</li>
              <li>Active &lt;30 days → 50 points</li>
              <li>Active &lt;90 days → 25 points</li>
              <li>Inactive 90+ days → 0 points</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-2">5️⃣ Review Score (0-500 points, deterministic)</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Count Score (0-250): Based on number of published reviews</li>
              <li>Rating Score (0-250): Based on average rating</li>
            </ul>
          </div>

          <div className="pt-4 border-t border-blue-200">
            <p className="font-semibold text-gray-900 mb-2">Ranking Rules</p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-gray-800">
              <li>Higher visibilityScore ranks higher</li>
              <li>Ties broken by: Manual &gt; Reviews &gt; Activity &gt; Recency</li>
              <li>If Visible = false → NEVER show regardless of score</li>
              <li>Deterministic - no randomization</li>
              <li>Safe defaults on errors - no crashes</li>
            </ul>
          </div>

          <p className="mt-4 pt-4 border-t border-blue-200">
            <strong>⚠️ Visibility Control:</strong> Detectives are hidden by default. Set <strong>Visible</strong> to true to show them on home page and search results.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
