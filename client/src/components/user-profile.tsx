import { useUser } from "@/hooks/use-user";
import { useWhopUser } from "@/hooks/use-whop-user";
import { useWhopPayments } from "@/hooks/use-whop-payments";
import { useWithdrawals } from "@/hooks/use-withdrawals";
import { Button } from "@/components/ui/button";
import { WithdrawalDialog } from "@/components/withdrawal-dialog";
import { Banknote } from "lucide-react";

export default function UserProfile() {
  const { user: whopUser, isLoading: whopLoading } = useWhopUser();
  const { data: user, isLoading } = useUser();
  const { makePayment, isPaymentPending, isRealPaymentsAvailable } = useWhopPayments();
  const { availableForWithdrawal, isLoadingTransactions } = useWithdrawals();

  const handleAddFunds = async (amount: number) => {
    try {
      await makePayment({
        amount,
        description: "Compete and Earn",
        metadata: { type: "game_credits" },
      });
    } catch (error) {
      // Error is already handled by useWhopPayments hook
    }
  };

  if (isLoading || whopLoading || !user || !whopUser) {
    return (
      <div className="bg-muted rounded-lg p-4 mb-6 animate-pulse">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-border"></div>
          <div className="flex-1">
            <div className="h-4 bg-border rounded mb-2"></div>
            <div className="h-3 bg-border rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card/95 border border-border rounded-xl p-3 shadow-lg backdrop-blur-sm min-w-[240px]">
      <div className="flex items-center space-x-3 mb-3">
        <div className="relative">
          <img 
            src={user.profileImageUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=80&h=80"} 
            alt="User profile picture" 
            className="w-10 h-10 rounded-full object-cover border-2 border-primary/30 shadow-md"
            data-testid="user-avatar"
          />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-card rounded-full"></div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm truncate" data-testid="user-username">
            {user.username}
          </h3>
          <p className="text-xs font-medium text-green-600 dark:text-green-400" data-testid="user-balance">
            ${parseFloat(user.balance).toFixed(2)}
          </p>
        </div>
      </div>
      
      <div className="space-y-2">
        <WithdrawalDialog>
          <Button 
            size="sm" 
            className="w-full text-xs font-medium border-green-500/20 text-green-600 hover:bg-green-500/10"
            variant="outline"
            disabled={!user || isLoadingTransactions || availableForWithdrawal < 20}
            data-testid="button-withdraw"
          >
            <Banknote className="w-3 h-3 mr-1" />
            Withdraw
          </Button>
        </WithdrawalDialog>
      </div>
    </div>
  );
}
