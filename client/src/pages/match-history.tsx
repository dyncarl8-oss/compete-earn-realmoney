import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useWhopUser } from "@/hooks/use-whop-user";
import { 
  Trophy, Crown, DollarSign, Users, ArrowLeft, Calendar, 
  TrendingUp, TrendingDown, Filter, ChevronRight, Medal, Sparkles
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface MatchHistoryPlayer {
  id: string;
  userId: string;
  username: string;
  totalScore: number;
  rank: number;
  entryFee: string;
  netChange: string;
}

interface MatchHistoryItem {
  id: string;
  gameId: string;
  winnerId: string;
  prizeAmount: string;
  completedAt: string;
  players: MatchHistoryPlayer[];
}

function useUserMatchHistory(userId: string, limit = 10, offset = 0) {
  return useQuery<MatchHistoryItem[]>({
    queryKey: [`/api/user/${userId}/match-history`, userId, limit, offset],
    queryFn: async () => {
      const response = await fetch(`/api/user/${userId}/match-history?limit=${limit}&offset=${offset}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch match history: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!userId,
  });
}

interface MatchHistoryProps {}

export default function MatchHistory({}: MatchHistoryProps) {
  const [, setLocation] = useLocation();
  const { user: whopUser } = useWhopUser();
  const [filterType, setFilterType] = useState<"all" | "wins" | "losses">("all");
  const { data: matchHistory, isLoading, error } = useUserMatchHistory(whopUser?.id || "");

  if (!whopUser) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="text-red-400 text-lg">Please log in to view match history</div>
          <Button onClick={() => setLocation("/")} variant="outline" data-testid="button-back-to-lobby-login">
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400">Loading match history...</span>
        </div>
      </div>
    );
  }

  if (error || !matchHistory) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="text-red-400 text-lg">Unable to load match history</div>
          <div className="text-slate-400 text-sm">Please try again later.</div>
          <Button onClick={() => setLocation("/")} variant="outline" data-testid="button-back-to-lobby-error">
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  const filteredHistory = matchHistory.filter((match) => {
    const myResult = match.players.find(p => p.userId === whopUser.id);
    if (!myResult) return false;
    
    if (filterType === "wins") return myResult.userId === match.winnerId;
    if (filterType === "losses") return myResult.userId !== match.winnerId;
    return true;
  });

  const totalMatches = matchHistory.length;
  const totalWins = matchHistory.filter(match => match.winnerId === whopUser.id).length;
  const totalLosses = totalMatches - totalWins;
  const totalWinnings = matchHistory.reduce((sum, match) => {
    const myResult = match.players.find(p => p.userId === whopUser.id);
    return sum + (myResult ? parseFloat(myResult.netChange) : 0);
  }, 0);

  const formatMoney = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num >= 0 ? `+$${Math.abs(num).toFixed(2)}` : `-$${Math.abs(num).toFixed(2)}`;
  };

  const getMoneyColor = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (num > 0) return "text-green-400";
    if (num < 0) return "text-red-400";
    return "text-slate-400";
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-4 h-4 text-yellow-500" />;
      case 2: return <Medal className="w-4 h-4 text-gray-400" />;
      case 3: return <Medal className="w-4 h-4 text-amber-600" />;
      default: return <span className="w-4 h-4 flex items-center justify-center text-slate-400 text-xs font-bold">#{rank}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-500/10 to-purple-600/10 border-blue-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="w-6 h-6 text-blue-500" />
              <span>Match History</span>
            </CardTitle>
            <Button
              onClick={() => setLocation("/")}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
              data-testid="button-back-to-lobby"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Lobby</span>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Your Statistics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{totalMatches}</div>
              <div className="text-sm text-slate-400">Total Games</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{totalWins}</div>
              <div className="text-sm text-slate-400">Wins</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{totalLosses}</div>
              <div className="text-sm text-slate-400">Losses</div>
            </div>
            <div className="text-center">
              <div className={cn("text-2xl font-bold flex items-center justify-center space-x-1", getMoneyColor(totalWinnings))}>
                {totalWinnings >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                <span>{formatMoney(totalWinnings)}</span>
              </div>
              <div className="text-sm text-slate-400">Net Total</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 text-sm">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Filter:</span>
            <Button
              variant={filterType === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterType("all")}
              data-testid="filter-all"
            >
              All Games ({totalMatches})
            </Button>
            <Button
              variant={filterType === "wins" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterType("wins")}
              data-testid="filter-wins"
            >
              Wins ({totalWins})
            </Button>
            <Button
              variant={filterType === "losses" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterType("losses")}
              data-testid="filter-losses"
            >
              Losses ({totalLosses})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Match History List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Matches ({filteredHistory.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p className="text-lg">No matches found</p>
              <p className="text-sm mt-1">
                {filterType === "wins" 
                  ? "You haven't won any games yet. Keep playing!" 
                  : filterType === "losses"
                  ? "Great job! No losses to show."
                  : "Start playing to see your match history here."}
              </p>
            </div>
          ) : (
            filteredHistory.map((match) => {
              const myResult = match.players.find(p => p.userId === whopUser.id);
              const winner = match.players.find(p => p.userId === match.winnerId);
              const isWin = myResult?.userId === match.winnerId;
              const otherPlayers = match.players.filter(p => p.userId !== whopUser.id);

              return (
                <Card 
                  key={match.id} 
                  className={cn(
                    "relative border transition-all hover:shadow-lg",
                    isWin 
                      ? "bg-green-500/5 border-green-500/30 hover:bg-green-500/10" 
                      : "bg-red-500/5 border-red-500/30 hover:bg-red-500/10"
                  )}
                  data-testid={`match-${match.id}`}
                >
                  <CardContent className="p-6">
                    {/* Match Result Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {isWin ? (
                          <div className="flex items-center space-x-2">
                            <Crown className="w-5 h-5 text-yellow-500" />
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              Victory
                            </Badge>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <Medal className="w-5 h-5 text-slate-400" />
                            <Badge variant="secondary">
                              Defeat
                            </Badge>
                          </div>
                        )}
                        <div className="text-sm text-slate-400 flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(match.completedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className={cn("text-lg font-bold", getMoneyColor(myResult?.netChange || "0"))}>
                            {formatMoney(myResult?.netChange || "0")}
                          </div>
                          <div className="text-xs text-slate-400">Net Change</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </div>
                    </div>

                    {/* My Performance */}
                    <div className="bg-slate-800/30 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getRankIcon(myResult?.rank || 1)}
                          <div>
                            <div className="font-medium text-slate-200">Your Performance</div>
                            <div className="text-sm text-slate-400">
                              Rank #{myResult?.rank} • Score: {myResult?.totalScore}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-slate-400">Entry: ${parseFloat(myResult?.entryFee || "0").toFixed(2)}</div>
                          <div className={cn("font-medium", getMoneyColor(myResult?.netChange || "0"))}>
                            Net: {formatMoney(myResult?.netChange || "0")}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Other Players */}
                    <div>
                      <div className="text-sm text-slate-400 mb-2">Other Players:</div>
                      <div className="space-y-2">
                        {otherPlayers.map((player) => (
                          <div key={player.userId} className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2">
                              {getRankIcon(player.rank)}
                              <span className={cn(
                                "font-medium",
                                player.userId === match.winnerId ? "text-yellow-400" : "text-slate-300"
                              )}>
                                {player.username}
                              </span>
                              {player.userId === match.winnerId && (
                                <Crown className="w-3 h-3 text-yellow-500" />
                              )}
                            </div>
                            <div className="flex items-center space-x-3 text-xs text-slate-400">
                              <span>Score: {player.totalScore}</span>
                              <span className={getMoneyColor(player.netChange)}>
                                {formatMoney(player.netChange)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Prize Pool Info */}
                    <Separator className="my-4" />
                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <div>Prize Pool: ${parseFloat(match.prizeAmount).toFixed(2)}</div>
                      <div>Winner: {winner?.username}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-slate-500 pb-8">
        <p>🎲 Keep playing to improve your stats and climb the leaderboard!</p>
      </div>
    </div>
  );
}