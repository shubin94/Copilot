import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

interface AlreadyVerifiedModalProps {
  open: boolean;
  onClose: () => void;
}

export function AlreadyVerifiedModal({ open, onClose }: AlreadyVerifiedModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-100 p-4 rounded-full">
              <CheckCircle className="h-12 w-12 text-blue-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">Already Verified!</DialogTitle>
          <DialogDescription className="text-center text-base">
            You already have the Blue Tick verification badge active on your profile.
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-sm text-blue-800">
            Your verified badge is visible to all users and helps build trust with potential clients.
          </p>
        </div>

        <DialogFooter>
          <Button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
