import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Download, Calendar, AlertCircle, CheckCircle2, Clock } from "lucide-react";

const BILLING_HISTORY: any[] = [];

export default function DetectiveBilling() {
  return (
    <DashboardLayout role="detective">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold font-heading text-gray-900">Billing & Payments</h2>
          <p className="text-gray-500">Manage your subscription, payment methods, and view payment history.</p>
        </div>

        <Card className="p-12 text-center">
          <CreditCard className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Billing Information</h3>
          <p className="text-gray-500 mb-6">Billing and subscription management will be available once you upgrade your plan.</p>
          <Button>View Plans</Button>
        </Card>
      </div>
    </DashboardLayout>
  );
}
