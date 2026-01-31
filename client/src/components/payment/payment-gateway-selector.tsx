import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Wallet } from "lucide-react";

interface PaymentGateway {
  name: string;
  display_name: string;
  is_enabled: boolean;
  icon?: string;
}

interface PaymentGatewaySelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (gateway: string) => void;
  gateways: PaymentGateway[];
}

const GATEWAY_ICONS: Record<string, any> = {
  razorpay: CreditCard,
  paypal: Wallet,
};

export function PaymentGatewaySelector({
  open,
  onClose,
  onSelect,
  gateways,
}: PaymentGatewaySelectorProps) {
  const handleSelect = (gatewayName: string) => {
    onSelect(gatewayName);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a payment method</DialogTitle>
          <DialogDescription>
            Select your preferred payment gateway to complete the transaction
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-3 py-4">
          {gateways.map((gateway) => {
            const Icon = GATEWAY_ICONS[gateway.name] || CreditCard;
            
            return (
              <Button
                key={gateway.name}
                variant="outline"
                className="h-20 flex items-center justify-start gap-4 hover:bg-gray-50 hover:border-green-500 transition-all"
                onClick={() => handleSelect(gateway.name)}
              >
                <div className="bg-gray-100 p-3 rounded-lg">
                  <Icon className="h-6 w-6 text-gray-700" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-base">{gateway.display_name}</div>
                  <div className="text-xs text-gray-500">
                    {gateway.name === "razorpay" && "Credit/Debit Card, UPI, Netbanking"}
                    {gateway.name === "paypal" && "PayPal Balance, Card"}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          className="w-full"
          onClick={onClose}
        >
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
