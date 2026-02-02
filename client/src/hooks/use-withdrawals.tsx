import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWhopUser } from "./use-whop-user";
import { useUser } from "./use-user";
import { useToast } from "./use-toast";
import { apiRequest, getQueryFn } from "@/lib/queryClient";

interface WithdrawalRequest {
  amount: number;
}

interface WithdrawalResponse {
  success: boolean;
  message: string;
  withdrawnAmount: string;
  remainingBalance: string;
  user: any;
}

interface Transaction {
  id: string;
  userId: string;
  type: string;
  amount: string;
  description: string;
  balanceAfter: string;
  createdAt: string;
  gameId?: string;
}

export function useWithdrawals() {
  const { user: whopUser } = useWhopUser();
  const { data: user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user transactions to calculate available winnings
  const transactionsQuery = useQuery<Transaction[]>({
    queryKey: [`/api/user/${whopUser?.id}/transactions`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!whopUser?.id,
  });

  // Calculate available withdrawal amount (full balance)
  const calculateAvailableWithdrawal = () => {
    // Users can now withdraw their full balance, not just winnings
    // This makes it simpler and more intuitive - they can withdraw whatever they have
    if (!user?.balance) return 0;
    return Math.max(0, parseFloat(user.balance));
  };

  // Request withdrawal mutation
  const requestWithdrawalMutation = useMutation({
    mutationFn: async ({ amount }: WithdrawalRequest): Promise<WithdrawalResponse> => {
      if (!whopUser?.id) throw new Error("User not authenticated");
      
      const response = await apiRequest("POST", `/api/user/${whopUser.id}/request-withdrawal`, {
        amount
      });
      
      return response.json();
    },
    onSuccess: async (data) => {
      // Invalidate and refetch user data to refresh balance immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/whop/user"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/user", whopUser?.id] }),
        queryClient.invalidateQueries({ queryKey: ["/api/user", whopUser?.id, "transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/user", whopUser?.id, "withdrawals"] }),
      ]);
      
      // Force refetch to ensure UI updates immediately
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/whop/user"] }),
        queryClient.refetchQueries({ queryKey: ["/api/user", whopUser?.id] }),
      ]);
      
      toast({
        title: "Withdrawal Requested ✅",
        description: data.message,
        duration: 5000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Withdrawal Failed ❌",
        description: error.message,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  // Get withdrawal history
  const withdrawalHistoryQuery = useQuery<Transaction[]>({
    queryKey: [`/api/user/${whopUser?.id}/withdrawals`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!whopUser?.id,
  });

  const requestWithdrawal = async (amount: number) => {
    return requestWithdrawalMutation.mutateAsync({ amount });
  };

  return {
    requestWithdrawal,
    isRequestingWithdrawal: requestWithdrawalMutation.isPending,
    withdrawalHistory: withdrawalHistoryQuery.data || [],
    isLoadingWithdrawals: withdrawalHistoryQuery.isLoading,
    withdrawalError: withdrawalHistoryQuery.error,
    availableForWithdrawal: calculateAvailableWithdrawal(),
    isLoadingTransactions: transactionsQuery.isLoading,
  };
}