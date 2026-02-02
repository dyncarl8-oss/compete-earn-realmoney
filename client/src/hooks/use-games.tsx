import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Game, GameParticipant, User } from "@shared/schema";
import { useWhopUser } from "./use-whop-user";

export function useGames() {
  return useQuery<Game[]>({
    queryKey: ["/api/games"],
    refetchInterval: 8000, // Reduced from 5s to 8s for better performance with Firestore
  });
}

export function useGame(gameId: string, stopPolling?: boolean) {
  return useQuery<Game>({
    queryKey: ["/api/games", gameId],
    refetchInterval: stopPolling ? false : 5000, // Reduced from 2s to 5s for better performance with Firestore
  });
}

export function useGameParticipants(gameId: string, stopPolling?: boolean) {
  return useQuery<(GameParticipant & { user?: User })[]>({
    queryKey: ["/api/games", gameId, "participants"],
    refetchInterval: stopPolling ? false : 5000, // Reduced from 2s to 5s for better performance with Firestore
    enabled: !!gameId, // Only run query when gameId is truthy
  });
}

export function useJoinGame() {
  const queryClient = useQueryClient();
  const { user: whopUser } = useWhopUser();
  
  return useMutation({
    mutationFn: async ({ gameId, userId }: { gameId: string; userId?: string }) => {
      const targetUserId = userId || whopUser?.id;
      if (!targetUserId) throw new Error("No user ID available");
      
      const response = await apiRequest("POST", `/api/games/${gameId}/join`, { userId: targetUserId });
      return response.json();
    },
    onSuccess: (_, { gameId, userId }) => {
      const targetUserId = userId || whopUser?.id;
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "participants"] });
      if (targetUserId) {
        queryClient.invalidateQueries({ queryKey: ["/api/user", targetUserId] });
        queryClient.invalidateQueries({ queryKey: ["/api/user", targetUserId, "active-game"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user", targetUserId, "transactions"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/whop/user"] });
    },
  });
}

export function useLeaveGame() {
  const queryClient = useQueryClient();
  const { user: whopUser } = useWhopUser();
  
  return useMutation({
    mutationFn: async ({ gameId, userId }: { gameId: string; userId?: string }) => {
      const targetUserId = userId || whopUser?.id;
      if (!targetUserId) throw new Error("No user ID available");
      
      const response = await apiRequest("POST", `/api/games/${gameId}/leave`, { userId: targetUserId });
      return response.json();
    },
    onSuccess: (_, { gameId, userId }) => {
      const targetUserId = userId || whopUser?.id;
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "participants"] });
      if (targetUserId) {
        queryClient.invalidateQueries({ queryKey: ["/api/user", targetUserId] });
        queryClient.invalidateQueries({ queryKey: ["/api/user", targetUserId, "active-game"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user", targetUserId, "transactions"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/whop/user"] });
    },
  });
}

export function useCreateGame() {
  const queryClient = useQueryClient();
  const { user: whopUser } = useWhopUser();
  
  return useMutation({
    mutationFn: async (gameData: { 
      name: string;
      gameType?: string;
      entryFee: string; 
      maxPlayers: number; 
      prizeAmount: string;
      gameMode?: string;
      aiOpponents?: number;
    }) => {
      const response = await apiRequest("POST", "/api/games", gameData);
      return response.json();
    },
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", game.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", game.id, "participants"] });
      // Invalidate active game since creator is automatically joined
      if (whopUser?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/user", whopUser.id, "active-game"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user", whopUser.id, "transactions"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/whop/user"] });
    },
  });
}
