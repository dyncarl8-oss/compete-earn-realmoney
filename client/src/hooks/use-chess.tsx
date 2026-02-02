import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface ChessPiece {
  type: 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
  color: 'white' | 'black';
}

export interface ChessPlayer {
  userId: string;
  username: string;
  profileImageUrl: string | null;
  color: 'white' | 'black';
}

export interface ChessMove {
  id: string;
  gameId: string;
  userId: string;
  moveNumber: number;
  fromSquare: string;
  toSquare: string;
  piece: string;
  capturedPiece: string | null;
  isCheck: boolean;
  isCheckmate: boolean;
  notation: string;
  createdAt: string;
}

export interface ChessGameState {
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
    createdAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
  };
  chessState: {
    id: string;
    gameId: string;
    boardState: (ChessPiece | null)[][];
    currentTurn: 'white' | 'black';
    whitePlayerId: string;
    blackPlayerId: string;
    capturedPieces: ChessPiece[];
    isCheck: boolean;
    isCheckmate: boolean;
    isStalemate: boolean;
    winner: string | null;
    enPassantTarget: string | null;
    whiteKingsideCastle: boolean;
    whiteQueensideCastle: boolean;
    blackKingsideCastle: boolean;
    blackQueensideCastle: boolean;
    moveCount: number;
  };
  players: ChessPlayer[];
  moves: ChessMove[];
}

export function useChessGameState(gameId: string) {
  return useQuery<ChessGameState>({
    queryKey: ["/api/games", gameId, "chess-state"],
    refetchInterval: (query) => (query.state.data?.game.status === "completed" ? false : 500),
    enabled: !!gameId,
  });
}

export function useMakeChessMove(gameId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ from, to, promotion }: { from: string; to: string; promotion?: string }) => {
      const response = await apiRequest("POST", `/api/games/${gameId}/chess/make-move`, { 
        from, 
        to, 
        promotion 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "chess-state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
    },
  });
}

export function useResignChess(gameId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/games/${gameId}/chess/resign`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "chess-state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
    },
  });
}

export function useValidMoves(gameId: string, square: string | null) {
  return useQuery<{ validMoves: string[] }>({
    queryKey: ["/api/games", gameId, "chess-valid-moves", square],
    enabled: !!gameId && !!square,
    staleTime: 0,
  });
}
