import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWhopUser } from "@/hooks/use-whop-user";
import { Trophy, Crown, DollarSign, ArrowLeft, History, Sparkles, Flag, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChessResultsProps {
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
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}

export default function ChessResults({ gameId }: ChessResultsProps) {
  const [, setLocation] = useLocation();
  const { user: whopUser } = useWhopUser();
  const { data: finalResults, isLoading, error } = useGameFinalResults(gameId);

  const handleBackToLobby = () => {
    setLocation("/");
  };

  const handleViewMatchHistory = () => {
    setLocation("/match-history");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-lg">Loading final results...</span>
        </div>
      </div>
    );
  }

  if (error || !finalResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-red-400 text-xl">
            Unable to load game results
          </div>
          <div className="text-slate-400">
            This may be an older game without saved results.
          </div>
          <Button onClick={handleBackToLobby} variant="outline">
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  const isWinner = whopUser?.id === finalResults.winnerId;
  const winner = finalResults.players.find(p => p.userId === finalResults.winnerId);
  const loser = finalResults.players.find(p => p.userId !== finalResults.winnerId);
  const myResult = finalResults.players.find(p => p.userId === whopUser?.id);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8">
      <div className="container mx-auto px-4">
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">♟️ Chess Match Results</h1>
            <p className="text-slate-400">Game Complete</p>
          </div>

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
                    <Trophy className="w-20 h-20 text-yellow-500" />
                    <Sparkles className="w-8 h-8 text-yellow-300 absolute -top-2 -right-2 animate-pulse" />
                  </div>
                ) : (
                  <Crown className="w-20 h-20 text-blue-500" />
                )}
              </div>
              
              <CardTitle className={cn(
                "text-3xl font-bold",
                isWinner ? "text-yellow-400" : "text-blue-400"
              )}>
                {isWinner ? "♔ CHECKMATE! VICTORY! ♔" : "😔 DEFEATED"}
              </CardTitle>
              
              <div className="text-center mt-4">
                {isWinner ? (
                  <div className="space-y-3">
                    <p className="text-xl text-slate-200">Outstanding! You outplayed your opponent!</p>
                    <p className="text-lg text-green-300">🏆 You are the Chess Champion! 🏆</p>
                    <div className="flex items-center justify-center space-x-3">
                      <DollarSign className="w-6 h-6 text-green-400" />
                      <span className="text-2xl font-bold text-green-400">
                        +${parseFloat(finalResults.prizeAmount).toFixed(2)} Prize Money
                      </span>
                    </div>
                    <p className="text-sm text-green-200">Brilliant strategy! Your chess skills paid off! 💰</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-lg text-slate-300">Better luck next time!</p>
                    <p className="text-base text-slate-400">
                      Winner: <span className="font-bold text-blue-400">{winner?.username}</span> claimed victory
                    </p>
                    <div className="flex items-center justify-center space-x-3">
                      <Trophy className="w-6 h-6 text-yellow-500" />
                      <span className="text-lg text-slate-400">
                        Prize: ${parseFloat(finalResults.prizeAmount).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">♟️ Study the game and come back stronger!</p>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {myResult && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Flag className="w-5 h-5" />
                  <span>Your Result</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className={cn(
                      "text-3xl font-bold",
                      myResult.rank === 1 ? "text-yellow-400" : "text-blue-400"
                    )}>
                      {myResult.rank === 1 ? "WINNER" : "DEFEATED"}
                    </div>
                    <div className="text-sm text-slate-400">Result</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-slate-300">${parseFloat(myResult.entryFee).toFixed(2)}</div>
                    <div className="text-sm text-slate-400">Entry Fee</div>
                  </div>
                  <div className="text-center">
                    <div className={cn("text-3xl font-bold flex items-center justify-center space-x-1", getMoneyColor(myResult.netChange))}>
                      {parseFloat(myResult.netChange) >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                      <span>{formatMoney(myResult.netChange)}</span>
                    </div>
                    <div className="text-sm text-slate-400">Net Change</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <span>Match Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[winner, loser].filter(Boolean).map((player) => (
                <div
                  key={player!.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border",
                    player!.userId === finalResults.winnerId
                      ? "bg-yellow-500/10 border-yellow-500/30" 
                      : player!.userId === whopUser?.id
                      ? "bg-blue-500/10 border-blue-500/30"
                      : "bg-slate-800 border-slate-700"
                  )}
                >
                  <div className="flex items-center space-x-3">
                    {player!.userId === finalResults.winnerId ? (
                      <Crown className="w-6 h-6 text-yellow-500" />
                    ) : (
                      <Flag className="w-6 h-6 text-slate-500" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={cn(
                          "font-medium text-lg",
                          player!.userId === finalResults.winnerId ? "text-yellow-400" : "text-slate-200"
                        )}>
                          {player!.username}
                        </span>
                        {player!.userId === whopUser?.id && (
                          <Badge variant="secondary" className="text-xs">You</Badge>
                        )}
                        {player!.userId === finalResults.winnerId && (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            Winner
                          </Badge>
                        )}
                        {player!.forfeited && (
                          <Badge variant="destructive" className="text-xs">
                            Resigned
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        Entry Fee: ${parseFloat(player!.entryFee).toFixed(2)}
                        {player!.forfeited && " • Resigned from match"}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={cn(
                      "font-bold text-xl",
                      getMoneyColor(player!.netChange)
                    )}>
                      {formatMoney(player!.netChange)}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleBackToLobby}
              variant="outline"
              size="lg"
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Lobby</span>
            </Button>
            
            <Button
              onClick={handleViewMatchHistory}
              size="lg"
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
            >
              <History className="w-4 h-4" />
              <span>View Match History</span>
            </Button>
          </div>

          <Card className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 border-slate-600">
            <CardContent className="pt-6">
              <div className="text-center text-sm text-slate-400">
                <p>♟️ Match completed at {new Date(finalResults.completedAt).toLocaleString()}</p>
                <p className="mt-1">{isWinner ? "Congratulations on your victory! Ready for another match?" : "Thanks for playing! Ready to get your revenge in the next game?"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
