import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const AGREEMENT_STORAGE_KEY = "gamepot_terms_accepted";
const AGREEMENT_VERSION = "1.0";

export default function FirstVisitAgreement() {
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const hasAccepted = localStorage.getItem(AGREEMENT_STORAGE_KEY);
    if (!hasAccepted || hasAccepted !== AGREEMENT_VERSION) {
      setOpen(true);
    }
  }, []);

  const handleAccept = () => {
    if (agreed) {
      localStorage.setItem(AGREEMENT_STORAGE_KEY, AGREEMENT_VERSION);
      setOpen(false);
    }
  };

  const handleViewTerms = () => {
    window.open("/terms", "_blank");
  };

  const handleViewPrivacy = () => {
    window.open("/privacy", "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-3xl">🎲</span>
            Welcome to Compete & Earn Real Money
          </DialogTitle>
          <DialogDescription className="text-slate-300 pt-2">
            Before you continue, please review and accept our terms and policies.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-300 text-sm leading-relaxed">
              By using Compete & Earn Real Money, you agree to our comprehensive Terms of Service and Privacy Policy. 
              These documents outline how we handle your data, game rules, payment terms, and your rights as a user.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
              onClick={handleViewTerms}
            >
              📄 View Terms of Service
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
              onClick={handleViewPrivacy}
            >
              🔒 View Privacy Policy
            </Button>
          </div>

          <div className="flex items-start space-x-3 pt-2">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked as boolean)}
              className="mt-1"
            />
            <label
              htmlFor="agree"
              className="text-sm text-slate-300 leading-relaxed cursor-pointer"
            >
              I have read and agree to the Terms of Service and Privacy Policy. I confirm that I am at least 18 years of age.
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={!agreed}
            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {agreed ? "Accept and Continue" : "Please accept to continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
