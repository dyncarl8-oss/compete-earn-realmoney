import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gamepad2, Plus, Loader2, Trophy, AlertCircle } from "lucide-react";
import { useGames, useCreateGame, useLeaveGame } from "@/hooks/use-games";
import { useUserActiveGame } from "@/hooks/use-user";
import { useAccessCheck } from "@/hooks/use-access-check";
import GameCard from "@/components/game-card";
import YahtzeeGame from "@/components/yahtzee-game";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

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

  const [resourceIds] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    let companyId = params.get('companyId') || undefined;
    let experienceId = params.get('experienceId') || undefined;
    return { companyId, experienceId };
  });

  const { isAdmin, isLoading: accessLoading } = useAccessCheck({
    companyId: resourceIds.companyId,
    experienceId: resourceIds.experienceId,
  });

  // Don't filter out active game - show all yahtzee games
  const yahtzeeGames = games?.filter(game => 
    game.gameType === "yahtzee"
  ) || [];

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

  if (accessLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-500 mx-auto" />
          <p className="text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <Card className="bg-gray-800 border-gray-700 max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
              <p className="text-gray-400 mb-4">Only admins can create Yahtzee tables. Please join a tournament created by your admin.</p>
              <Button onClick={() => setLocation("/")} className="bg-emerald-600 hover:bg-emerald-700">
                Return to Lobby
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    </div>
  );
}
