import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Check, X, Shield, Crown, Star, Mail, Phone, MessageCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  features: string[];
  badges: {
    blueTick: boolean;
    pro: boolean;
    recommended: boolean;
  };
  serviceLimit: number;
  active: boolean;
}

const INITIAL_PLANS: SubscriptionPlan[] = [];

export default function AdminSubscriptions() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(INITIAL_PLANS);
  const [blueTickPrice, setBlueTickPrice] = useState({ monthly: 15, yearly: 150 });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const { toast } = useToast();
  
  // Form State
  const [formData, setFormData] = useState<Partial<SubscriptionPlan>>({
    name: "",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "",
    features: [],
    badges: {
      blueTick: false,
      pro: false,
      recommended: false
    },
    serviceLimit: 1,
    active: true
  });
  const [featureInput, setFeatureInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.subscriptionPlans.getAll({ includeInactive: true });
        setPlans(Array.isArray(res.plans) ? res.plans as any : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load plans");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleOpenDialog = (plan?: SubscriptionPlan) => {
    if (plan) {
      setCurrentPlan(plan);
      setFormData({
        name: plan.name,
        monthlyPrice: Number((plan as any).monthlyPrice ?? 0),
        yearlyPrice: Number((plan as any).yearlyPrice ?? 0),
        description: (plan as any).description ?? "",
        features: Array.isArray((plan as any).features) ? (plan as any).features : [],
        badges: (plan as any).badges ?? { blueTick: false, pro: false, recommended: false },
        serviceLimit: Number((plan as any).serviceLimit ?? 0),
        active: Boolean((plan as any).isActive),
      });
    } else {
      setCurrentPlan(null);
      setFormData({
        name: "",
        monthlyPrice: 0,
        yearlyPrice: 0,
        description: "",
        features: [],
        badges: {
          blueTick: false,
          pro: false,
          recommended: false
        },
        serviceLimit: 1,
        active: true
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.name.trim()) {
      toast({ title: "Invalid data", description: "Plan name is required", variant: "destructive" });
      return;
    }
    if ((formData.monthlyPrice ?? 0) < 0 || (formData.yearlyPrice ?? 0) < 0) {
      toast({ title: "Invalid data", description: "Prices must be non-negative", variant: "destructive" });
      return;
    }
    if (!Number.isInteger(formData.serviceLimit ?? 0) || (formData.serviceLimit ?? 0) < 0) {
      toast({ title: "Invalid data", description: "Service limit must be a non-negative integer", variant: "destructive" });
      return;
    }
    const payload: any = {
      name: String(formData.name || "").toLowerCase().trim(),
      displayName: String((formData as any).displayName || formData.name || "").trim(),
      monthlyPrice: Number(formData.monthlyPrice ?? 0),
      yearlyPrice: Number(formData.yearlyPrice ?? 0),
      description: formData.description,
      features: Array.isArray(formData.features) ? formData.features : [],
      badges: formData.badges,
      serviceLimit: Number(formData.serviceLimit ?? 0),
      isActive: formData.active !== false,
    };
    if (currentPlan) {
      api.subscriptionPlans.update(currentPlan.id, payload).then(async () => {
        try {
          const res = await api.subscriptionPlans.getAll({ includeInactive: true });
          setPlans(Array.isArray(res.plans) ? res.plans as any : []);
        } catch {}
        setIsDialogOpen(false);
        toast({ title: "Updated", description: "Plan updated" });
      }).catch(e => {
        toast({ title: "Error", description: e?.message || "Failed to update plan", variant: "destructive" });
      });
    } else {
      api.subscriptionPlans.create(payload).then(async () => {
        try {
          const res = await api.subscriptionPlans.getAll({ includeInactive: true });
          setPlans(Array.isArray(res.plans) ? res.plans as any : []);
        } catch {}
        setIsDialogOpen(false);
        toast({ title: "Created", description: "Plan created" });
      }).catch(e => {
        toast({ title: "Error", description: e?.message || "Failed to create plan", variant: "destructive" });
      });
    }
  };

  const handleDelete = () => {
    if (currentPlan) {
      api.subscriptionPlans.delete(currentPlan.id).then(() => {
        setPlans(plans.filter(p => p.id !== currentPlan.id));
        setIsDeleteDialogOpen(false);
        setCurrentPlan(null);
        toast({ title: "Deleted", description: "Plan deleted" });
      }).catch(e => {
        toast({ title: "Error", description: e?.message || "Failed to delete plan", variant: "destructive" });
      });
    }
  };

  const addFeature = () => {
    if (featureInput.trim()) {
      setFormData({
        ...formData,
        features: [...(formData.features || []), featureInput.trim()]
      });
      setFeatureInput("");
    }
  };

  const removeFeature = (index: number) => {
    const newFeatures = [...(formData.features || [])];
    newFeatures.splice(index, 1);
    setFormData({ ...formData, features: newFeatures });
  };

  const toggleBadge = (badge: keyof SubscriptionPlan['badges']) => {
    setFormData(prev => ({
      ...prev,
      badges: {
        ...prev.badges!,
        [badge]: !prev.badges![badge]
      }
    }));
  };

  const applyServiceLimits = async () => {
    const free = Number(plans.find(p => p.id === "free")?.serviceLimit || 2);
    const pro = Number(plans.find(p => p.id === "pro")?.serviceLimit || 4);
    const agencyPlan = plans.find(p => p.id === "agency")?.serviceLimit || "1000";
    const agency = agencyPlan === "unlimited" ? 1000 : Number(agencyPlan);
    try {
      const response = await fetch("/api/admin/subscription-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ free, pro, agency })
      });
      if (!response.ok) throw new Error("Failed to update limits");
      toast({ title: "Updated", description: "Service limits applied" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to update service limits", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold font-heading text-gray-900">Subscription Plans</h2>
            <p className="text-gray-500">Manage pricing tiers and features for detectives.</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="bg-gray-900 hover:bg-gray-800 text-white">
            <Plus className="h-4 w-4 mr-2" /> Create New Plan
          </Button>
        </div>

        {/* Blue Tick Configuration */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">Add-on Service</Badge>
              <CardTitle className="text-lg text-blue-900">Blue Tick Verification</CardTitle>
            </div>
            <CardDescription className="text-blue-700/80">
              Set the standalone price for the Blue Tick verification badge (included free in Agency plan).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="space-y-2 w-32">
                <Label htmlFor="bt-monthly">Monthly ($)</Label>
                <Input 
                  id="bt-monthly" 
                  type="number" 
                  value={blueTickPrice.monthly} 
                  onChange={(e) => setBlueTickPrice({...blueTickPrice, monthly: Number(e.target.value)})}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2 w-32">
                <Label htmlFor="bt-yearly">Yearly ($)</Label>
                <Input 
                  id="bt-yearly" 
                  type="number" 
                  value={blueTickPrice.yearly} 
                  onChange={(e) => setBlueTickPrice({...blueTickPrice, yearly: Number(e.target.value)})}
                  className="bg-white"
                />
              </div>
              <Button onClick={() => alert("Blue Tick pricing updated!")} className="bg-blue-600 hover:bg-blue-700 text-white">
                Update Pricing
              </Button>
            </div>
          </CardContent>
        </Card>

        {(() => {
          if (loading) {
            return <Card><CardContent><p>Loading...</p></CardContent></Card>;
          }
          if (!plans || plans.length === 0) {
            return <Card><CardContent><p>No plans available</p></CardContent></Card>;
          }
          return <Card>
          <CardHeader>
            <CardTitle>Plans</CardTitle>
            <CardDescription>
              Showing all plans (active and inactive).
            </CardDescription>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="secondary">Total: {plans.length}</Badge>
              <Button variant="outline" size="sm" onClick={async () => {
                setLoading(true);
                try {
                  const res = await api.subscriptionPlans.getAll({ includeInactive: true });
                  setPlans(Array.isArray(res.plans) ? res.plans as any : []);
                } catch (e: any) {
                  setError(e?.message || "Failed to load plans");
                } finally {
                  setLoading(false);
                }
              }}>Refresh</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan Name</TableHead>
                  <TableHead>Price (Mo/Yr)</TableHead>
                  <TableHead>Service Limit</TableHead>
                  <TableHead>Badges</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">
                      <div>{(plan as any).displayName || plan.name}</div>
                      <div className="text-[10px] text-gray-400">ID: {plan.id}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">{(plan as any).description}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">${(plan as any).monthlyPrice} / ${(plan as any).yearlyPrice}</div>
                    </TableCell>
                    <TableCell>
                       <Badge variant="outline">{`${(plan as any).serviceLimit} Services`}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {(plan as any).badges?.blueTick && <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-[10px] px-1"><Check className="h-3 w-3 mr-1"/> Blue Tick</Badge>}
                        {(plan as any).badges?.pro && <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-[10px] px-1"><Crown className="h-3 w-3 mr-1"/> Pro</Badge>}
                        {(plan as any).badges?.recommended && <Badge className="bg-green-500 hover:bg-green-600 text-white text-[10px] px-1"><Star className="h-3 w-3 mr-1"/> Recommended</Badge>}
                      </div>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {Array.isArray((plan as any).features) && (plan as any).features.includes("contact_email") && (
                          <Badge variant="outline" className="text-[10px] px-1"><Mail className="h-3 w-3 mr-1" /> Email</Badge>
                        )}
                        {Array.isArray((plan as any).features) && (plan as any).features.includes("contact_phone") && (
                          <Badge variant="outline" className="text-[10px] px-1"><Phone className="h-3 w-3 mr-1" /> Phone</Badge>
                        )}
                        {Array.isArray((plan as any).features) && (plan as any).features.includes("contact_whatsapp") && (
                          <Badge variant="outline" className="text-[10px] px-1"><MessageCircle className="h-3 w-3 mr-1" /> WhatsApp</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={(plan as any).isActive ? "default" : "secondary"} className={(plan as any).isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : ""}>
                        {(plan as any).isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(plan)}>
                          <Pencil className="h-4 w-4 text-gray-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setCurrentPlan(plan); setIsDeleteDialogOpen(true); }}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end mt-4">
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={applyServiceLimits}>Apply Service Limits</Button>
            </div>
          </CardContent>
        </Card>;
        })()}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{currentPlan ? "Edit Plan" : "Create New Plan"}</DialogTitle>
              <DialogDescription>
                Configure the subscription details below.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Plan Name</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g. Enterprise"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthlyPrice">Monthly Price ($)</Label>
                  <Input 
                    id="monthlyPrice" 
                    type="number" 
                    value={formData.monthlyPrice} 
                    onChange={(e) => setFormData({...formData, monthlyPrice: Number(e.target.value)})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearlyPrice">Yearly Price ($)</Label>
                  <Input 
                    id="yearlyPrice" 
                    type="number" 
                    value={formData.yearlyPrice} 
                    onChange={(e) => setFormData({...formData, yearlyPrice: Number(e.target.value)})} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})} 
                  placeholder="Short description of the plan..."
                />
              </div>
              
              <div className="space-y-2">
                 <Label>Service Limit</Label>
                 <Select 
                   value={String(formData.serviceLimit ?? 1)} 
                   onValueChange={(val) => setFormData({...formData, serviceLimit: Number(val)})}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Select limit" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="1">1 Service</SelectItem>
                     <SelectItem value="2">2 Services</SelectItem>
                     <SelectItem value="3">3 Services</SelectItem>
                     <SelectItem value="4">4 Services</SelectItem>
                     <SelectItem value="5">5 Services</SelectItem>
                     <SelectItem value="10">10 Services</SelectItem>
                   </SelectContent>
                 </Select>
                 <p className="text-xs text-gray-500">How many service categories can a detective add?</p>
              </div>

              <div className="space-y-2">
                <Label>Plan Features</Label>
                <div className="flex gap-2">
                  <Input 
                    value={featureInput} 
                    onChange={(e) => setFeatureInput(e.target.value)} 
                    placeholder="Add a feature..."
                    onKeyDown={(e) => e.key === 'Enter' && addFeature()}
                  />
                  <Button type="button" onClick={addFeature} size="sm" variant="secondary">Add</Button>
                </div>
                <div className="bg-gray-50 rounded-md p-2 space-y-1 min-h-[100px] max-h-[200px] overflow-y-auto border">
                  {formData.features?.map((feature, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                      <span>{feature}</span>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-500" onClick={() => removeFeature(idx)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(!formData.features || formData.features.length === 0) && (
                    <div className="text-center text-gray-400 py-4 text-sm">No features added yet</div>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Label className="text-base">Plan Badges & Visibility</Label>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between border p-3 rounded-md bg-blue-50/30 border-blue-100">
                    <div className="flex items-center gap-2">
                       <Check className="h-4 w-4 text-blue-600" />
                       <Label htmlFor="badge-bluetick" className="cursor-pointer text-blue-900">Blue Tick</Label>
                    </div>
                    <Switch 
                      id="badge-bluetick" 
                      checked={formData.badges?.blueTick} 
                      onCheckedChange={() => toggleBadge('blueTick')} 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between border p-3 rounded-md bg-yellow-50/30 border-yellow-100">
                    <div className="flex items-center gap-2">
                       <Crown className="h-4 w-4 text-yellow-600" />
                       <Label htmlFor="badge-pro" className="cursor-pointer text-yellow-900">Pro Badge</Label>
                    </div>
                    <Switch 
                      id="badge-pro" 
                      checked={formData.badges?.pro} 
                      onCheckedChange={() => toggleBadge('pro')} 
                    />
                  </div>

                  <div className="flex items-center justify-between border p-3 rounded-md bg-green-50/30 border-green-100">
                    <div className="flex items-center gap-2">
                       <Star className="h-4 w-4 text-green-600" />
                       <Label htmlFor="badge-rec" className="cursor-pointer text-green-900">Recommended</Label>
                    </div>
                    <Switch 
                      id="badge-rec" 
                      checked={formData.badges?.recommended} 
                      onCheckedChange={() => toggleBadge('recommended')} 
                    />
                  </div>

                  <div className="flex items-center justify-between border p-3 rounded-md">
                    <Label htmlFor="active" className="cursor-pointer">Plan Active</Label>
                    <Switch 
                      id="active" 
                      checked={formData.active} 
                      onCheckedChange={(c) => setFormData({...formData, active: c})} 
                    />
                  </div>
                </div>
              </div>
          
          <div className="space-y-3 pt-2">
            <Label className="text-base">Contact Visibility</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between border p-3 rounded-md">
                <Label htmlFor="contact-email" className="cursor-pointer">Email</Label>
                <Switch 
                  id="contact-email" 
                  checked={Array.isArray(formData.features) ? formData.features.includes("contact_email") : false}
                  onCheckedChange={(c) => {
                    const set = new Set(formData.features || []);
                    c ? set.add("contact_email") : set.delete("contact_email");
                    setFormData({ ...formData, features: Array.from(set) as any });
                  }} 
                />
              </div>
              <div className="flex items-center justify-between border p-3 rounded-md">
                <Label htmlFor="contact-phone" className="cursor-pointer">Phone Number</Label>
                <Switch 
                  id="contact-phone" 
                  checked={Array.isArray(formData.features) ? formData.features.includes("contact_phone") : false}
                  onCheckedChange={(c) => {
                    const set = new Set(formData.features || []);
                    c ? set.add("contact_phone") : set.delete("contact_phone");
                    setFormData({ ...formData, features: Array.from(set) as any });
                  }} 
                />
              </div>
              <div className="flex items-center justify-between border p-3 rounded-md">
                <Label htmlFor="contact-whatsapp" className="cursor-pointer">WhatsApp</Label>
                <Switch 
                  id="contact-whatsapp" 
                  checked={Array.isArray(formData.features) ? formData.features.includes("contact_whatsapp") : false}
                  onCheckedChange={(c) => {
                    const set = new Set(formData.features || []);
                    c ? set.add("contact_whatsapp") : set.delete("contact_whatsapp");
                    setFormData({ ...formData, features: Array.from(set) as any });
                  }} 
                />
              </div>
            </div>
          </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">Save Plan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Plan</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the <strong>{currentPlan?.name}</strong> plan? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
