import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

interface WelcomeBonusModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function WelcomeBonusModal({
  isOpen,
  onClose,
  userId,
}: WelcomeBonusModalProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleClaim = async () => {
    try {
      setIsClaiming(true);
      
      const response = await apiRequest("POST", `/api/user/${userId}/claim-welcome-bonus`, {});
      const data = await response.json();
      
      if (data.success) {
        // Invalidate and refetch user data to ensure balance updates immediately
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/whop/user"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/user", userId] }),
          queryClient.invalidateQueries({ queryKey: ["/api/user", userId, "transactions"] }),
        ]);

        // Force refetch to ensure UI updates before closing modal
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ["/api/whop/user"] }),
          queryClient.refetchQueries({ queryKey: ["/api/user", userId] }),
        ]);
        
        toast({
          title: "Welcome Bonus Claimed!",
          description: "$2.77 has been added to your account. Start playing now!",
        });
        
        onClose();
      }
    } catch (error) {
      console.error("Failed to claim welcome bonus:", error);
      toast({
        title: "Error",
        description: "Failed to claim welcome bonus. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-gradient-to-b from-slate-800 to-slate-900 border-slate-700">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full blur-xl opacity-75 animate-pulse"></div>
              <div className="relative bg-gradient-to-r from-violet-500 to-purple-600 p-4 rounded-full">
                <Gift className="h-12 w-12 text-white" />
              </div>
            </div>
          </div>
          <DialogTitle className="text-center text-2xl font-bold text-white">
            Welcome to Compete & Earn Real Money!
          </DialogTitle>
          <DialogDescription className="text-center text-base mt-2 text-slate-400">
            Start your journey with a special welcome bonus
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/30 rounded-xl p-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Sparkles className="h-6 w-6 text-emerald-400" />
              <span className="text-base font-medium text-emerald-300">Welcome Bonus</span>
              <Sparkles className="h-6 w-6 text-emerald-400" />
            </div>
            <div className="text-6xl font-bold text-emerald-400 mb-3">
              $2.77
            </div>
            <p className="text-base text-slate-300">
              Free credits to start playing!
            </p>
          </div>

          <Button 
            onClick={handleClaim}
            disabled={isClaiming}
            className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold py-6 text-lg shadow-lg transition-all duration-200"
          >
            {isClaiming ? "Claiming..." : "Claim $2.77 Now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
