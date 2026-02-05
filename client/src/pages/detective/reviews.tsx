import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, MessageSquare, ThumbsUp, Flag } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReviewsByDetective } from "@/lib/hooks";
import { format } from "date-fns";

export default function DetectiveReviews() {
  const { data, isLoading } = useReviewsByDetective();
  const reviews = data?.reviews || [] as any[];
  const avg = reviews.length ? (reviews.reduce((sum, r: any) => sum + (r.rating || 0), 0) / reviews.length) : 0;
  const fivePct = reviews.length ? Math.round((reviews.filter((r: any) => r.rating === 5).length / reviews.length) * 100) : 0;

  return (
    <DashboardLayout role="detective">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold font-heading text-gray-900">My Reviews</h2>
          <p className="text-gray-500">See what clients are saying about your services.</p>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Average Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{avg.toFixed(1)}</span>
                <div className="flex text-yellow-500">
                  <Star className="h-4 w-4" />
                  <Star className="h-4 w-4" />
                  <Star className="h-4 w-4" />
                  <Star className="h-4 w-4" />
                  <Star className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reviews.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">5 Star Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fivePct}%</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="w-[400px]">Comment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-gray-500">Loading…</TableCell></TableRow>
                ) : reviews.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-gray-500">No reviews yet.</TableCell></TableRow>
                ) : reviews.map((review: any) => (
                  <TableRow key={review.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{(review.userId || "U")[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{review.serviceTitle || "Service"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex text-yellow-500">
                        {[...Array(review.rating || 0)].map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-current" />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600 italic">"{review.comment}"</TableCell>
                    <TableCell>{review.createdAt ? format(new Date(review.createdAt), "MMM d, yyyy") : ""}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-50">
                        <MessageSquare className="h-4 w-4 mr-2" /> Reply
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
