import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useWhopUser } from "@/hooks/use-whop-user";
import { Trophy, Crown, DollarSign, Users, ArrowLeft, History, Sparkles, Medal, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface GameEndScreenProps {
  gameId: string;
}

interface MatchResultPlayer {
  id: string;
  userId: string;
  username: string;
  totalScore: number;
  rank: number;
  entryFee: string;
  netChange: string;
  forfeited: boolean;
}

interface MatchResult {
  id: string;
  gameId: string;
  winnerId: string;
  prizeAmount: string;
  completedAt: string;
  players: MatchResultPlayer[];
}

function useGameFinalResults(gameId: string) {
  return useQuery<MatchResult>({
    queryKey: [`/api/games/${gameId}/final-results`, gameId],
    queryFn: async () => {
      const response = await fetch(`/api/games/${gameId}/final-results`);
      if (!response.ok) {
        throw new Error(`Failed to fetch game results: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!gameId,
  });
}

export default function GameEndScreen({ gameId }: GameEndScreenProps) {
  const [, setLocation] = useLocation();
  const { user: whopUser } = useWhopUser();
  const { data: finalResults, isLoading, error } = useGameFinalResults(gameId);
  const [showDetails, setShowDetails] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400">Loading final results...</span>
        </div>
      </div>
    );
  }

  if (error || !finalResults) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="text-red-400 text-lg">
            Unable to load game results
          </div>
          <div className="text-slate-400 text-sm">
            This may be an older game without saved results.
          </div>
          <Button onClick={() => setLocation("/")} variant="outline" data-testid="button-back-to-lobby-error">
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  const isWinner = whopUser?.id === finalResults.winnerId;
  
  // Sort by rank first, then deduplicate to keep the best-ranked entry per user
  const sortedByRank = [...finalResults.players].sort((a, b) => a.rank - b.rank);
  const uniquePlayers = sortedByRank.filter((player, index, self) =>
    index === self.findIndex((p) => p.userId === player.userId)
  );
  // Recompute contiguous ranks (1, 2, 3, etc.) after deduplication
  const sortedPlayers = uniquePlayers.map((player, index) => ({
    ...player,
    rank: index + 1
  }));
  
  // Use deduplicated data for winner and personal result
  const winner = sortedPlayers.find(p => p.userId === finalResults.winnerId);
  let myResult = sortedPlayers.find(p => p.userId === whopUser?.id);
  
  // Safety fallback: if user not in deduplicated list, use original data
  if (!myResult && whopUser?.id) {
    myResult = finalResults.players.find(p => p.userId === whopUser?.id);
  }

  const formatMoney = (amount: string) => {
    const num = parseFloat(amount);
    return num >= 0 ? `+$${Math.abs(num).toFixed(2)}` : `-$${Math.abs(num).toFixed(2)}`;
  };

  const getMoneyColor = (amount: string) => {
    const num = parseFloat(amount);
    if (num > 0) return "text-green-400";
    if (num < 0) return "text-red-400";
    return "text-slate-400";
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2: return <Medal className="w-5 h-5 text-gray-400" />;
      case 3: return <Medal className="w-5 h-5 text-amber-600" />;
      default: return <span className="w-5 h-5 flex items-center justify-center text-slate-400 font-bold">#{rank}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Winner Announcement */}
      <Card className={cn(
        "relative overflow-hidden border-2",
        isWinner 
          ? "bg-gradient-to-r from-yellow-500/20 via-yellow-600/10 to-yellow-500/20 border-yellow-500/50 shadow-lg shadow-yellow-500/25" 
          : "bg-gradient-to-r from-blue-500/10 to-purple-600/10 border-blue-500/20"
      )}>
        {isWinner && (
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-transparent to-yellow-500/5 animate-pulse" />
        )}
        
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            {isWinner ? (
              <div className="relative">
                <Trophy className="w-16 h-16 text-yellow-500" />
                <Sparkles className="w-6 h-6 text-yellow-300 absolute -top-2 -right-2 animate-pulse" />
              </div>
            ) : (
              <Crown className="w-16 h-16 text-blue-500" />
            )}
          </div>
          
          <CardTitle className={cn(
            "text-2xl font-bold",
            isWinner ? "text-yellow-400" : "text-blue-400"
          )}>
            {isWinner ? "🎉 CONGRATULATIONS! 🎉" : "Game Complete!"}
          </CardTitle>
          
          <div className="text-center mt-2">
            {isWinner ? (
              <div className="space-y-2">
                <p className="text-lg text-slate-300">You are the Yahtzee champion!</p>
                <div className="flex items-center justify-center space-x-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <span className="text-xl font-bold text-green-400">
                    +${parseFloat(finalResults.prizeAmount).toFixed(2)} Prize Money
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-lg text-slate-300">
                  Winner: <span className="font-bold text-blue-400">{winner?.username}</span>
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="text-slate-400">
                    Prize: ${parseFloat(finalResults.prizeAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Personal Result Summary */}
      {myResult && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Your Result</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">#{myResult.rank}</div>
                <div className="text-sm text-slate-400">Final Rank</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{myResult.totalScore}</div>
                <div className="text-sm text-slate-400">Total Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-300">${parseFloat(myResult.entryFee).toFixed(2)}</div>
                <div className="text-sm text-slate-400">Entry Fee</div>
              </div>
              <div className="text-center">
                <div className={cn("text-2xl font-bold flex items-center justify-center space-x-1", getMoneyColor(myResult.netChange))}>
                  {parseFloat(myResult.netChange) >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  <span>{formatMoney(myResult.netChange)}</span>
                </div>
                <div className="text-sm text-slate-400">Net Change</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Final Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span>Final Leaderboard</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs"
              data-testid="button-toggle-details"
            >
              {showDetails ? "Hide Details" : "Show Details"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedPlayers.map((player, index) => (
            <div
              key={player.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-lg border",
                player.rank === 1 
                  ? "bg-yellow-500/10 border-yellow-500/30" 
                  : player.userId === whopUser?.id
                  ? "bg-blue-500/10 border-blue-500/30"
                  : "bg-slate-800 border-slate-700"
              )}
              data-testid={`leaderboard-player-${player.userId}`}
            >
              <div className="flex items-center space-x-3">
                {getRankIcon(player.rank)}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={cn(
                      "font-medium",
                      player.rank === 1 ? "text-yellow-400" : "text-slate-200"
                    )}>
                      {player.username}
                    </span>
                    {player.userId === whopUser?.id && (
                      <Badge variant="secondary" className="text-xs">You</Badge>
                    )}
                    {player.rank === 1 && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        Winner
                      </Badge>
                    )}
                    {player.forfeited && (
                      <Badge variant="destructive" className="text-xs">
                        Forfeited
                      </Badge>
                    )}
                  </div>
                  {showDetails && (
                    <div className="text-sm text-slate-400 mt-1">
                      Score: {player.totalScore} • Entry: ${parseFloat(player.entryFee).toFixed(2)}
                      {player.forfeited && " • Left game early"}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <div className={cn(
                  "font-bold",
                  getMoneyColor(player.netChange)
                )}>
                  {formatMoney(player.netChange)}
                </div>
                {showDetails && (
                  <div className="text-xs text-slate-500">
                    Rank #{player.rank}
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          className="flex items-center space-x-2"
          data-testid="button-back-to-lobby"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Lobby</span>
        </Button>
        
        <Button
          onClick={() => setLocation("/match-history")}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
          data-testid="button-view-history"
        >
          <History className="w-4 h-4" />
          <span>View Match History</span>
        </Button>
      </div>

      {/* Fun Stats Footer */}
      <Card className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 border-slate-600">
        <CardContent className="pt-6">
          <div className="text-center text-sm text-slate-400">
            <p>🎲 Game completed at {new Date(finalResults.completedAt).toLocaleDateString()}</p>
            <p className="mt-1">Thanks for playing! Create a new game or join another table to continue the fun.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}