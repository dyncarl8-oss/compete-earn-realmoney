import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface YahtzeePlayerState {
  id: string;
  gameId: string;
  userId: string;
  // Upper Section Categories
  ones: number;
  twos: number;
  threes: number;
  fours: number;
  fives: number;
  sixes: number;
  upperSectionBonus: number;
  // Lower Section Categories
  threeOfAKind: number;
  fourOfAKind: number;
  fullHouse: number;
  smallStraight: number;
  largeStraight: number;
  yahtzee: number;
  yahtzeeBonus: number;
  chance: number;
  totalScore: number;
  turnsCompleted: number;
}

export interface YahtzeeTurn {
  id: string;
  gameId: string;
  userId: string;
  round: number;
  rollCount: number;
  dice1: number;
  dice2: number;
  dice3: number;
  dice4: number;
  dice5: number;
  hold1: boolean;
  hold2: boolean;
  hold3: boolean;
  hold4: boolean;
  hold5: boolean;
  isCompleted: boolean;
  scoredCategory: string | null;
  scoredPoints: number | null;
}

export interface YahtzeeGameState {
  game: {
    id: string;
    name: string;
    gameType: string;
    entryFee: string;
    maxPlayers: number;
    currentPlayers: number;
    prizeAmount: string;
    status: string;
    winnerId: string | null;
    currentRound: number;
    totalRounds: number;
    currentTurnPlayerId: string | null;
    createdAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
  };
  players: Array<{
    user: {
      id: string;
      username: string;
      profileImageUrl: string | null;
    };
    state: YahtzeePlayerState | null;
  }>;
  currentTurnUserId: string;
  currentRound: number;
}

export function useYahtzeeGameState(gameId: string) {
  return useQuery<YahtzeeGameState>({
    queryKey: ["/api/games", gameId, "yahtzee-state"],
    refetchInterval: (query) => (query.state.data?.game.status === "completed" ? false : 5000), // Reduced from 2s to 5s for better performance with Firestore
    enabled: !!gameId,
  });
}

export function useCurrentTurn(gameId: string, stopPolling?: boolean) {
  return useQuery<YahtzeeTurn>({
    queryKey: ["/api/games", gameId, "current-turn"],
    refetchInterval: stopPolling ? false : 3000, // Reduced from 1s to 3s for better performance with Firestore
    enabled: !!gameId && !stopPolling, // Fully disable query when game is completed
  });
}

export function useRollDice(gameId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/games/${gameId}/roll-dice`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });
    },
  });
}

export function useHoldDice(gameId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ diceIndex, hold }: { diceIndex: number; hold: boolean }) => {
      const response = await apiRequest("POST", `/api/games/${gameId}/hold-dice`, { diceIndex, hold });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });
    },
  });
}

export function useScoreCategory(gameId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ category }: { category: string }) => {
      const response = await apiRequest("POST", `/api/games/${gameId}/score-category`, { category });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
    },
  });
}