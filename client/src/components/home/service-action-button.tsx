import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUserSafe } from "@/lib/user-context";

export type ServiceAction = {
  id: string;
  phone?: string;
  whatsapp?: string;
  contactEmail?: string;
};

interface ServiceActionButtonProps {
  service: ServiceAction;
}

export function ServiceActionButton({ service }: ServiceActionButtonProps) {
  const { user, isFavorite, toggleFavorite } = useUserSafe();
  const { toast } = useToast();

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save favorites.",
        variant: "destructive",
      });
      return;
    }

    toggleFavorite(service.id);
  };

  if (service.phone || service.whatsapp) {
    const phoneNumber = service.whatsapp || service.phone;
    return (
      <Button
        size="sm"
        className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(`tel:${phoneNumber}`, "_self");
        }}
      >
        Call Now
      </Button>
    );
  }

  if (service.contactEmail) {
    return (
      <Button
        size="sm"
        className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(`mailto:${service.contactEmail}`, "_blank");
        }}
      >
        Email Now
      </Button>
    );
  }

  return (
    <Heart
      className={`h-4 w-4 hover:scale-110 transition-transform cursor-pointer ${
        isFavorite(service.id)
          ? "fill-red-500 text-red-500"
          : "text-gray-400 hover:text-red-500"
      }`}
      onClick={handleFavoriteClick}
    />
  );
}
