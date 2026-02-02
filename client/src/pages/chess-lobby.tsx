import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gamepad2, Plus, Loader2, Trophy, AlertCircle } from "lucide-react";
import { useGames, useCreateGame } from "@/hooks/use-games";
import { useUserActiveGame } from "@/hooks/use-user";
import { useAccessCheck } from "@/hooks/use-access-check";
import GameCard from "@/components/game-card";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

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
  const { toast } = useToast();

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

  if (accessLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
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
              <p className="text-gray-400 mb-4">Only admins can create chess matches. Please join a tournament created by your admin.</p>
              <Button onClick={() => setLocation("/")} className="bg-blue-600 hover:bg-blue-700">
                Return to Lobby
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    </div>
  );
}
