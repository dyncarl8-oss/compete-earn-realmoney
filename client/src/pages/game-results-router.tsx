import { useQuery } from "@tanstack/react-query";
import GameResults from "./game-results";
import ChessResults from "./chess-results";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

interface GameResultsRouterProps {
  gameId: string;
}

interface Game {
  id: string;
  gameType: string;
  status: string;
}

function useGame(gameId: string) {
  return useQuery<Game>({
    queryKey: [`/api/games/${gameId}`, gameId],
    queryFn: async () => {
      const response = await fetch(`/api/games/${gameId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch game: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!gameId,
  });
}

export default function GameResultsRouter({ gameId }: GameResultsRouterProps) {
  const [, setLocation] = useLocation();
  const { data: game, isLoading, error } = useGame(gameId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-lg">Loading game results...</span>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-red-400 text-xl">
            Unable to load game
          </div>
          <div className="text-slate-400">
            This game could not be found.
          </div>
          <Button onClick={() => setLocation("/")} variant="outline">
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  if (game.gameType === "chess") {
    return <ChessResults gameId={gameId} />;
  } else {
    return <GameResults gameId={gameId} />;
  }
}
