import { useParams, useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import YahtzeeGame from "@/components/yahtzee-game";
import ChessGame from "@/components/chess-game";
import { useGame } from "@/hooks/use-games";

interface GameRoomProps {
  gameId?: string;
}

export default function GameRoom({ gameId: propGameId }: GameRoomProps) {
  const params = useParams();
  const [, setLocation] = useLocation();
  
  // Use gameId from props or params
  const gameId = propGameId || params.gameId;
  
  // Get game to determine game type
  const { data: game, isLoading: gameLoading, error } = useGame(gameId || '');
  
  // Redirect to lobby if no gameId
  useEffect(() => {
    if (!gameId) {
      setLocation('/');
    }
  }, [gameId, setLocation]);

  // Navigate to results when game is completed
  useEffect(() => {
    if (game?.status === "completed") {
      setLocation(`/results/${gameId}`);
    }
  }, [game?.status, gameId, setLocation]);

  // Handle navigation back to lobby
  const handleBackToLobby = () => {
    setLocation('/');
  };

  // Loading state
  if (gameLoading || !gameId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-slate-400">Loading game room...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl mb-4">🎲</div>
          <h1 className="text-2xl font-bold text-white">Game Not Found</h1>
          <p className="text-slate-400 max-w-md">
            The game room you're looking for doesn't exist or has ended.
          </p>
          <Button 
            onClick={handleBackToLobby}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  // Render the appropriate game component based on game type
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-2 py-2">
        {game.gameType === "chess" ? (
          <ChessGame 
            gameId={gameId} 
            onBack={handleBackToLobby}
          />
        ) : (
          <YahtzeeGame 
            gameId={gameId} 
            onBackToLobby={handleBackToLobby}
          />
        )}
      </div>
    </div>
  );
}
