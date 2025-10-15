import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function WelcomePopup() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("gamepot-welcome-seen");
    
    // Don't show popup on Terms or Privacy pages
    const isTermsOrPrivacy = location === "/terms" || location === "/privacy";
    
    if (!hasSeenWelcome && !isTermsOrPrivacy) {
      // Add a 1.5 second delay before showing the popup for a smooth transition
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [location]);

  const handleAccept = () => {
    localStorage.setItem("gamepot-welcome-seen", "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700" hideCloseButton>
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Welcome to Compete & Earn Real Money</h2>
          <p className="text-slate-300 text-sm">
            By using Compete & Earn Real Money, you agree to our{" "}
            <a 
              href="/terms" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a 
              href="/privacy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              Privacy Policy
            </a>
            .
          </p>
          <Button
            onClick={handleAccept}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            I Understand
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
