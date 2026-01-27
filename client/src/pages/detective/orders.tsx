import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Paperclip, Clock, CheckCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ORDERS = [
  { id: "ORD-7821", client: "Client A", service: "Background Check (Standard)", price: "$300", date: "Aug 24, 2025", status: "In Progress", due: "2 days" },
  { id: "ORD-7820", client: "Client B", service: "Surveillance (Premium)", price: "$1,200", date: "Aug 22, 2025", status: "Pending Requirements", due: "5 days" },
  { id: "ORD-7815", client: "Client C", service: "Asset Search", price: "$450", date: "Aug 18, 2025", status: "Completed", due: "-" },
];

export default function DetectiveOrders() {
  return (
    <DashboardLayout role="detective">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold font-heading text-gray-900">Manage Orders</h2>
          <p className="text-gray-500">Track your active investigations and deliverables.</p>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Client / Service</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Due In</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ORDERS.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">{order.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                         <span className="font-bold text-sm">{order.client}</span>
                         <span className="text-xs text-gray-500">{order.service}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold">{order.price}</TableCell>
                    <TableCell>{order.date}</TableCell>
                    <TableCell>
                      {order.due !== "-" && <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">{order.due}</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        order.status === "Completed" ? "bg-green-100 text-green-700 hover:bg-green-200" : 
                        order.status === "In Progress" ? "bg-blue-100 text-blue-700 hover:bg-blue-200" :
                        "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                         <Button size="icon" variant="ghost" title="Message Client">
                           <MessageSquare className="h-4 w-4 text-gray-500" />
                         </Button>
                         <Button size="icon" variant="ghost" title="Deliver Work">
                           <Paperclip className="h-4 w-4 text-gray-500" />
                         </Button>
                      </div>
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
