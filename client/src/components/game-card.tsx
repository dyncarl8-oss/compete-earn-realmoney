import { Button } from "@/components/ui/button";
import { useJoinGame } from "@/hooks/use-games";
import { useWhopUser } from "@/hooks/use-whop-user";
import { useWhopPayments } from "@/hooks/use-whop-payments";
import { useGameWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2, Play, Trophy, Users } from "lucide-react";
import type { Game } from "@shared/schema";

interface GameCardProps {
  game: Game;
  disabled?: boolean;
}

export default function GameCard({ game, disabled = false }: GameCardProps) {
  const joinGame = useJoinGame();
  const { user } = useWhopUser();
  const { makePayment, isPaymentPending } = useWhopPayments();
  const { lastUpdate } = useGameWebSocket(game.id);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleJoinGame = async () => {
    try {
      // For Whop integration, we could trigger payment first
      // For now, we'll use the existing balance system but with Whop auth
      await joinGame.mutateAsync({ gameId: game.id });
      toast({
        title: "Joined game successfully",
        description: `You've joined ${game.name}. Waiting for other players...`,
      });
      
      // Don't navigate - stay on lobby page to show waiting area
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to join game";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleWhopPayment = async () => {
    try {
      // Get the appropriate Whop plan ID for this game's entry fee
      const amount = parseFloat(game.entryFee);
      const planId = amount <= 1 ? "plan_game_entry_1_dollar" : 
                    amount <= 2 ? "plan_game_entry_2_dollar" :
                    amount <= 5 ? "plan_game_entry_5_dollar" :
                    "plan_game_entry_10_dollar";
      
      // Trigger Whop payment for game entry
      await makePayment({
        amount,
        description: `Entry fee for ${game.name}`,
      });
      
      // After successful payment, join the game
      await handleJoinGame();
    } catch (error) {
      // Payment error is already handled by useWhopPayments hook
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-green-500";
      case "filling":
        return "bg-amber-500";
      case "full":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "open":
        return "Open";
      case "filling":
        return "Filling";
      case "full":
        return "Full";
      default:
        return status;
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-violet-500/50 backdrop-blur-sm"
         data-testid={`game-card-${game.id}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-bold text-white" data-testid={`game-name-${game.id}`}>
            {game.name}
          </h3>
        </div>
        <span className={`${getStatusColor(game.status)} text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg`}
              data-testid={`game-status-${game.id}`}>
          {getStatusText(game.status)}
        </span>
      </div>
      
      <div className="space-y-3 mb-6">
        <div className="bg-slate-700/30 rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-300 text-sm">Entry Fee:</span>
            <span className="text-white font-bold" data-testid={`game-entry-fee-${game.id}`}>
              ${parseFloat(game.entryFee).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-300 text-sm flex items-center gap-1">
              <Users className="w-4 h-4" />Players:
            </span>
            <span className="text-white font-bold" data-testid={`game-players-${game.id}`}>
              {game.currentPlayers}/{game.maxPlayers}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-300 text-sm">Prize Pool:</span>
            <span className="text-emerald-400 font-bold text-lg" data-testid={`game-prize-${game.id}`}>
              ${parseFloat(game.prizeAmount).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      
      <button 
        className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 hover:scale-105 disabled:hover:scale-100 disabled:opacity-50 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        onClick={user ? handleJoinGame : handleWhopPayment}
        disabled={disabled || joinGame.isPending || isPaymentPending || game.status === "full"}
        data-testid={`button-join-game-${game.id}`}
      >
        {joinGame.isPending || isPaymentPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {joinGame.isPending ? "Joining..." : "Processing Payment..."}
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Join Game
          </>
        )}
      </button>
    </div>
  );
}
