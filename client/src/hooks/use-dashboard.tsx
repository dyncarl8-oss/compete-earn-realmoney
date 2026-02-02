import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UserData {
  id: string;
  username: string;
  name: string | null;
  created_at: string;
  bio: string | null;
  profile_picture: {
    url: string | null;
  } | null;
}

interface LedgerAccountBalance {
  balance: number;
  currency: string;
  pending_balance: number;
  reserve_balance: number;
}

interface LedgerAccountData {
  company?: {
    ledgerAccount: {
      id: string;
      balances: LedgerAccountBalance[];
      transfer_fee: number | null;
      ledger_account_audit_status: string | null;
      payments_approval_status: string | null;
      ledger_type: string;
    };
  };
}

interface TransferParams {
  amount: number;
  currency?: string;
  destinationId: string;
  ledgerAccountId: string;
  transferFee?: number;
  notes?: string;
}

export function useDashboardUser(userId: string | null) {
  return useQuery<UserData>({
    queryKey: ['/api/whop/dashboard/user', userId],
    queryFn: () => apiRequest('GET', `/api/whop/dashboard/user/${userId}`),
    enabled: !!userId,
  });
}

export function useDashboardLedgerAccount(companyId: string | null) {
  return useQuery<LedgerAccountData>({
    queryKey: ['/api/whop/dashboard/ledger-account', companyId],
    queryFn: () => apiRequest('GET', `/api/whop/dashboard/ledger-account/${companyId}`),
    enabled: !!companyId,
  });
}

export function useDashboardTransfer() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (params: TransferParams) =>
      apiRequest('POST', '/api/whop/dashboard/transfer', params),
    onSuccess: () => {
      toast({
        title: "Transfer Successful",
        description: "Payment has been sent to the user's Whop account.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
