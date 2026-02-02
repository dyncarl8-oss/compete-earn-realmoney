import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { User, Game } from "@shared/schema";
import { useWhopUser } from "./use-whop-user";

export function useUser(userId?: string) {
  const { user: whopUser } = useWhopUser();
  const targetUserId = userId || whopUser?.id;
  
  return useQuery<User>({
    queryKey: ["/api/user", targetUserId],
    enabled: !!targetUserId,
  });
}

export function useAddFunds(userId?: string) {
  const { user: whopUser } = useWhopUser();
  const targetUserId = userId || whopUser?.id;
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (amount: number) => {
      if (!targetUserId) throw new Error("No user ID available");
      
      // Use Whop payment system instead of direct fund addition
      const response = await apiRequest("POST", "/api/whop/charge-user", {
        amount,
        currency: "usd",
        description: "Compete and Earn",
        metadata: {
          type: "credits",
          userId: targetUserId,
        },
      });
      return response.json();
    },
    onSuccess: () => {
      if (targetUserId) {
        queryClient.invalidateQueries({ queryKey: ["/api/user", targetUserId] });
        queryClient.invalidateQueries({ queryKey: ["/api/user", targetUserId, "transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/whop/user"] });
      }
    },
  });
}

export function useUserActiveGame(userId?: string) {
  const { user: whopUser } = useWhopUser();
  const targetUserId = userId || whopUser?.id;
  
  return useQuery<Game | null>({
    queryKey: ["/api/user", targetUserId, "active-game"],
    enabled: !!targetUserId,
    refetchInterval: 2000, // Poll every 2 seconds for real-time updates
  });
}

export function useUserTransactions(userId?: string) {
  const { user: whopUser } = useWhopUser();
  const targetUserId = userId || whopUser?.id;
  
  return useQuery({
    queryKey: ["/api/user", targetUserId, "transactions"],
    enabled: !!targetUserId,
  });
}
