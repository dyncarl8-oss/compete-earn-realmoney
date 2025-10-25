import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gamepad2, Plus, Loader2, Trophy, Timer } from "lucide-react";
import { useGames, useCreateGame, useGameParticipants, useLeaveGame } from "@/hooks/use-games";
import { useUserActiveGame } from "@/hooks/use-user";
import GameCard from "@/components/game-card";
import InvitePlayersModal from "@/components/invite-players-modal";
import YahtzeeGame from "@/components/yahtzee-game";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

function CreateTableDialog() {
  const [open, setOpen] = useState(false);
  const [entryFee, setEntryFee] = useState("2.00");
  const [maxPlayers, setMaxPlayers] = useState("3");
  const [timeLimit, setTimeLimit] = useState("10");
  const createGame = useCreateGame();
  const { toast } = useToast();

  const handleCreateTable = async () => {
    try {
      const playerCount = parseInt(maxPlayers);
      const fee = parseFloat(entryFee);
      const prizePool = (fee * playerCount * 0.95).toFixed(2);
      
      await createGame.mutateAsync({
        name: `Yahtzee Table ${new Date().toLocaleTimeString()}`,
        gameType: "yahtzee",
        entryFee: entryFee,
        maxPlayers: playerCount,
        prizeAmount: prizePool,
      });
      
      setOpen(false);
      toast({
        title: "Table Created & Joined!",
        description: `You've created and joined a ${playerCount}-player table. Waiting for others to join...`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create table. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 hover:scale-105 flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Create Table</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Create New Yahtzee Table</DialogTitle>
          <DialogDescription className="text-slate-300">
            Set up a new competitive Yahtzee table. Players compete for the highest score to win the prize pool.
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="maxPlayers" className="text-right text-white">
              Max Players
            </Label>
            <Select value={maxPlayers} onValueChange={setMaxPlayers}>
              <SelectTrigger className="col-span-3 bg-slate-800 border-slate-600 text-white">
                <SelectValue placeholder="Select max players" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="2">2 Players</SelectItem>
                <SelectItem value="3">3 Players</SelectItem>
                <SelectItem value="4">4 Players</SelectItem>
                <SelectItem value="5">5 Players</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="timeLimit" className="text-right text-white">
              Time Limit
            </Label>
            <Select value={timeLimit} onValueChange={setTimeLimit}>
              <SelectTrigger className="col-span-3 bg-slate-800 border-slate-600 text-white">
                <SelectValue placeholder="Select time limit" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="10">10 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="20">20 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-600">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Prize Pool:</span>
              <span className="text-emerald-400 font-bold">
                ${(parseFloat(entryFee) * parseInt(maxPlayers) * 0.95).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Platform Fee (5%):</span>
              <span>${(parseFloat(entryFee) * parseInt(maxPlayers) * 0.05).toFixed(2)}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button 
            type="submit" 
            onClick={handleCreateTable}
            disabled={createGame.isPending}
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
          >
            {createGame.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Table"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function YahtzeeLobby() {
  const [, setLocation] = useLocation();
  const { data: games } = useGames();
  const { data: activeGame } = useUserActiveGame();
  const { data: participants } = useGameParticipants(activeGame?.id || "");
  const leaveGame = useLeaveGame();
  const { toast } = useToast();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Don't filter out active game - show all yahtzee games
  const yahtzeeGames = games?.filter(game => 
    game.gameType === "yahtzee"
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

  // Check if user has an active yahtzee game in waiting/filling status
  const hasActiveYahtzeeGame = activeGame?.gameType === "yahtzee" && (activeGame?.status === "waiting" || activeGame?.status === "filling" || activeGame?.status === "open");
  
  // Check if user has an active yahtzee game that is running
  const isPlayingYahtzee = activeGame?.gameType === "yahtzee" && activeGame?.status === "running";

  // Debug logging
  console.log("YahtzeeLobby Debug:", {
    hasActiveGame: !!activeGame,
    gameType: activeGame?.gameType,
    gameStatus: activeGame?.status,
    isPlayingYahtzee,
    gameId: activeGame?.id
  });

  // If game is running, show the game directly
  if (isPlayingYahtzee && activeGame) {
    console.log("Rendering YahtzeeGame with gameId:", activeGame.id);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-2 py-2">
          <YahtzeeGame gameId={activeGame.id} onBackToLobby={() => setLocation("/yahtzee")} />
        </div>
      </div>
    );
  }

  console.log("Rendering normal lobby view");

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
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg">
                <Gamepad2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">🎲 Yahtzee</h1>
                <p className="text-slate-400 font-medium">Roll dice & score strategically to win!</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-3 rounded-xl shadow-lg">
                <span className="text-white font-bold">{yahtzeeGames.length} Tables Available</span>
              </div>
              <CreateTableDialog />
            </div>
          </div>
          
          {/* Show waiting area if user has joined a table */}
          {hasActiveYahtzeeGame && activeGame && (
            <div className="mb-8 bg-gradient-to-br from-violet-900/50 to-purple-900/50 rounded-2xl p-6 border-2 border-violet-500 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">🎮 Your Current Game</h2>
                <Button
                  onClick={handleLeaveGame}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                >
                  Leave Game
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
                  <h3 className="text-xl font-bold text-white">Battle Arena</h3>
                  <span className="bg-violet-600 text-white px-4 py-1 rounded-full text-sm font-bold">
                    {activeGame.currentPlayers}/{activeGame.maxPlayers} Players
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  {participants?.map((participant) => (
                    <div key={participant.userId} className="bg-gradient-to-br from-violet-600/30 to-purple-600/30 rounded-lg p-4 border border-violet-500/50">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-violet-500 rounded-full flex items-center justify-center text-white font-bold">
                          {participant.user?.username.charAt(0).toUpperCase() || 'P'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold truncate">{participant.user?.username || 'Player'}</p>
                          <p className="text-violet-300 text-sm">Player</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {Array.from({ length: activeGame.maxPlayers - (activeGame.currentPlayers || 0) }).map((_, i) => (
                    <button
                      key={`empty-${i}`}
                      type="button"
                      onClick={() => setIsInviteModalOpen(true)}
                      className="bg-slate-800/30 rounded-lg p-4 border-2 border-dashed border-slate-600 hover:border-violet-500 hover:bg-slate-700/30 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Plus className="w-8 h-8 text-slate-500 mx-auto mb-2 group-hover:text-violet-400 transition-colors" />
                          <p className="text-slate-500 text-sm hover:text-violet-400 transition-colors">Click to Invite</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-4 text-center">
                  <p className="text-amber-200 font-medium flex items-center justify-center gap-2">
                    <Timer className="w-5 h-5" />
                    Waiting for more players to join...
                  </p>
                  <p className="text-amber-300/70 text-sm mt-1">Game starts when lobby is full</p>
                </div>
              </div>
            </div>
          )}

          {/* Available Tables */}
          {yahtzeeGames.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {yahtzeeGames.map((game) => {
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
                <div className="w-32 h-32 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full mx-auto mb-8 flex items-center justify-center shadow-lg">
                  <Gamepad2 className="w-16 h-16 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">No Yahtzee Tables Available</h3>
                <p className="text-slate-400 text-xl mb-8">Create a new table to start playing!</p>
                
                <div className="flex justify-center gap-4">
                  <CreateTableDialog />
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
          shareUrl={`${window.location.origin}/game/${activeGame.id}`}
        />
      )}
    </div>
  );
}
