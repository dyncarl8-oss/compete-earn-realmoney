import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gamepad2, Plus, Loader2, Trophy, Timer } from "lucide-react";
import { useGames, useCreateGame, useGameParticipants, useLeaveGame } from "@/hooks/use-games";
import { useUserActiveGame } from "@/hooks/use-user";
import GameCard from "@/components/game-card";
import InvitePlayersModal from "@/components/invite-players-modal";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function CreateChessTableDialog() {
  const [open, setOpen] = useState(false);
  const [entryFee, setEntryFee] = useState("5.00");
  const createGame = useCreateGame();
  const { toast } = useToast();

  const handleCreateTable = async () => {
    try {
      const fee = parseFloat(entryFee);
      const prizePool = (fee * 2 * 0.95).toFixed(2); // 2 players, 5% platform fee
      
      await createGame.mutateAsync({
        name: `Chess Match ${new Date().toLocaleTimeString()}`,
        gameType: "chess",
        entryFee: entryFee,
        maxPlayers: 2, // Chess is always 2 players
        prizeAmount: prizePool,
      });
      
      setOpen(false);
      toast({
        title: "Chess Match Created & Joined!",
        description: `You've created and joined a chess match. Waiting for opponent...`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create chess table. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 hover:scale-105 flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Create Chess Match</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Create New Chess Match</DialogTitle>
          <DialogDescription className="text-slate-300">
            Set up a 1v1 chess match. Winner takes all!
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="entryFee" className="text-right text-white">
              Entry Fee
            </Label>
            <Input
              id="entryFee"
              type="number"
              step="0.50"
              min="0.50"
              max="50.00"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              className="col-span-3 bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-600">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Prize Pool:</span>
              <span className="text-blue-400 font-bold">
                ${(parseFloat(entryFee) * 2 * 0.95).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Platform Fee (5%):</span>
              <span>${(parseFloat(entryFee) * 2 * 0.05).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Players:</span>
              <span>2 (1v1 Match)</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button 
            type="submit" 
            onClick={handleCreateTable}
            disabled={createGame.isPending}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800"
          >
            {createGame.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Chess Match"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ChessLobby() {
  const [, setLocation] = useLocation();
  const { data: games } = useGames();
  const { data: activeGame } = useUserActiveGame();
  const { data: participants } = useGameParticipants(activeGame?.id || "");
  const leaveGame = useLeaveGame();
  const { toast } = useToast();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Only auto-navigate when game actually starts running
  useEffect(() => {
    if (activeGame?.status === "running" && activeGame.gameType === "chess") {
      setLocation(`/chess/${activeGame.id}`);
    }
  }, [activeGame, setLocation]);

  // Don't filter out active game - show all chess games
  const chessGames = games?.filter(game => 
    game.gameType === "chess"
  ) || [];

  const handleLeaveGame = async () => {
    if (!activeGame) return;

    try {
      await leaveGame.mutateAsync({ gameId: activeGame.id });
      toast({
        title: "Left game successfully",
        description: "You've been refunded the entry fee.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to leave game. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Check if user has an active chess game in waiting/filling status
  const hasActiveChessGame = activeGame?.gameType === "chess" && (activeGame?.status === "waiting" || activeGame?.status === "filling" || activeGame?.status === "open");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Button
            onClick={() => setLocation("/")}
            variant="ghost"
            className="text-white hover:bg-slate-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Lobby
          </Button>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg">
                <Gamepad2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">♟️ Chess</h1>
                <p className="text-slate-400 font-medium">Outsmart your opponent in strategic battles!</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-3 rounded-xl shadow-lg">
                <span className="text-white font-bold">{chessGames.length} Matches Available</span>
              </div>
              <CreateChessTableDialog />
            </div>
          </div>
          
          {/* Show waiting area if user has joined a chess match */}
          {hasActiveChessGame && activeGame && (
            <div className="mb-8 bg-gradient-to-br from-blue-900/50 to-indigo-900/50 rounded-2xl p-6 border-2 border-blue-500 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">♟️ Your Chess Match</h2>
                <Button
                  onClick={handleLeaveGame}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                >
                  Leave Match
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center justify-center mb-2">
                    <Trophy className="w-6 h-6 text-pink-400 mr-2" />
                    <span className="text-slate-300 text-sm">Entry Fee</span>
                  </div>
                  <p className="text-3xl font-bold text-pink-400 text-center">${parseFloat(activeGame.entryFee).toFixed(2)}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center justify-center mb-2">
                    <Trophy className="w-6 h-6 text-emerald-400 mr-2" />
                    <span className="text-slate-300 text-sm">Prize Pool</span>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400 text-center">${parseFloat(activeGame.prizeAmount).toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-white">Players</h3>
                  <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold">
                    {activeGame.currentPlayers}/2 Players
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {participants?.map((participant) => (
                    <div key={participant.userId} className="bg-gradient-to-br from-blue-600/30 to-indigo-600/30 rounded-lg p-4 border border-blue-500/50">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                          {participant.user?.username.charAt(0).toUpperCase() || 'P'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold truncate">{participant.user?.username || 'Player'}</p>
                          <p className="text-blue-300 text-sm">Player</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {Array.from({ length: 2 - (activeGame.currentPlayers || 0) }).map((_, i) => (
                    <button
                      key={`empty-${i}`}
                      type="button"
                      onClick={() => setIsInviteModalOpen(true)}
                      className="bg-slate-800/30 rounded-lg p-4 border-2 border-dashed border-slate-600 hover:border-blue-500 hover:bg-slate-700/30 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Plus className="w-8 h-8 text-slate-500 mx-auto mb-2 hover:text-blue-400 transition-colors" />
                          <p className="text-slate-500 text-sm hover:text-blue-400 transition-colors">Click to Invite</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-4 text-center">
                  <p className="text-amber-200 font-medium flex items-center justify-center gap-2">
                    <Timer className="w-5 h-5" />
                    Waiting for opponent to join...
                  </p>
                  <p className="text-amber-300/70 text-sm mt-1">Match starts when both players are ready</p>
                </div>
              </div>
            </div>
          )}

          {/* Available Matches */}
          {chessGames.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {chessGames.map((game) => {
                const isCurrentGame = activeGame?.id === game.id;
                return (
                  <GameCard 
                    key={game.id} 
                    game={game} 
                    disabled={!!activeGame && !isCurrentGame}
                  />
                );
              })}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-16 text-center shadow-2xl">
              <div className="mb-10">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full mx-auto mb-8 flex items-center justify-center shadow-lg">
                  <span className="text-6xl">♟️</span>
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">No Chess Matches Available</h3>
                <p className="text-slate-400 text-xl mb-8">Create a new match to start playing!</p>
                
                <div className="flex justify-center gap-4">
                  <CreateChessTableDialog />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite Players Modal */}
      {activeGame && (
        <InvitePlayersModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          gameId={activeGame.id}
          gameName={activeGame.name}
          shareUrl={`${window.location.origin}/chess/${activeGame.id}`}
        />
      )}
    </div>
  );
}
