import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWhopIframe } from "@/hooks/use-whop-iframe";
import { useWhopUser } from "@/hooks/use-whop-user";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PaymentOptions {
  amount: number;
  description?: string;
  metadata?: Record<string, any>;
}

export function useWhopPayments() {
  const { toast } = useToast();
  const { iframeSdk, isAvailable, isInWhopIframe } = useWhopIframe();
  const { user: whopUser } = useWhopUser();
  const queryClient = useQueryClient();

  const makePayment = useMutation({
    mutationFn: async (options: PaymentOptions) => {
      if (!whopUser) {
        throw new Error("User not authenticated");
      }

      // Always allow payments when iframe SDK is available
      // The SDK itself will handle the iframe environment properly

      if (!iframeSdk) {
        throw new Error("Whop payment system not available");
      }

      console.log("🔄 Creating charge on server...");
      // Step 1: Create charge on server (following Whop docs)
      const response = await apiRequest("POST", "/api/whop/charge-user", {
        amount: options.amount,
        currency: "usd",
        description: options.description || "Compete and Earn",
        metadata: options.metadata,
      });

      const inAppPurchase = await response.json();
      console.log("✅ Charge created, opening payment modal...", inAppPurchase);

      // Step 2: Open payment modal using iframe SDK
      const result = await iframeSdk.inAppPurchase(inAppPurchase);
      console.log("💳 Payment result:", result);

      if (result.status === "error") {
        throw new Error(result.error || "Payment failed");
      }

      return result;
    },
    onSuccess: (result) => {
      // Invalidate user data to refresh balance
      queryClient.invalidateQueries({ queryKey: ["/api/whop/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "Payment Successful",
        description: `Payment completed successfully. Receipt ID: ${result.data?.receipt_id}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Failed", 
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    makePayment: makePayment.mutateAsync,
    isPaymentPending: makePayment.isPending,
    isRealPaymentsAvailable: isAvailable,
    isInWhopIframe,
  };
}