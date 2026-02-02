import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { Trophy, Users, DollarSign, Clock, LogOut } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface Tournament {
  id: string;
  name: string;
  gameType: string;
  entryFee: string;
  potAmount: string;
  maxParticipants: number;
  currentParticipants: number;
  status: string;
  gameId?: string;
  description?: string;
}

interface TournamentParticipant {
  id: string;
  userId: string;
  tournamentId: string;
  joinedAt: Date;
  username: string;
  profileImageUrl: string | null;
}

export default function TournamentWaitingRoom() {
  const [, params] = useRoute("/tournament/:id/waiting");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userQuery = useUser();
  const user = userQuery?.data;
  const queryClient = useQueryClient();
  const tournamentId = params?.id;

  const { data: tournament, isLoading } = useQuery<Tournament>({
    queryKey: [`/api/tournaments/${tournamentId}`],
    queryFn: async () => {
      const response = await fetch(`/api/tournaments/${tournamentId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch tournament");
      }
      return response.json();
    },
    enabled: !!tournamentId,
    refetchInterval: 3000,
  });

  const { data: participants } = useQuery<TournamentParticipant[]>({
    queryKey: [`/api/tournaments/${tournamentId}/participants`],
    queryFn: async () => {
      const response = await fetch(`/api/tournaments/${tournamentId}/participants`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch participants");
      }
      return response.json();
    },
    enabled: !!tournamentId,
    refetchInterval: 3000,
  });

  const leaveTournament = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tournaments/${tournamentId}/leave`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to leave tournament");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Left Tournament",
        description: "You have successfully left the tournament",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (tournament?.status === "completed" || tournament?.status === "cancelled") {
      toast({
        title: "Tournament Ended",
        description: `This tournament has been ${tournament.status}`,
        variant: "default",
      });
      setLocation("/");
    } else if (tournament?.status === "started" && tournament?.gameId) {
      // Tournament has started, navigate to the game room
      toast({
        title: "Tournament Started!",
        description: "Navigating to your game...",
      });
      // Navigate to the appropriate game room based on game type
      if (tournament.gameType === "yahtzee") {
        setLocation(`/game/${tournament.gameId}`);
      } else if (tournament.gameType === "chess") {
        setLocation(`/chess/${tournament.gameId}`);
      }
    }
  }, [tournament?.status, tournament?.gameId, tournament?.gameType, setLocation, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading tournament...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Tournament not found</div>
      </div>
    );
  }

  const isUserParticipant = participants?.some(p => p.userId === user?.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-yellow-500/50 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Trophy className="w-10 h-10 text-yellow-500" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{tournament.name}</h1>
                <p className="text-sm text-gray-400 capitalize">{tournament.gameType} Tournament</p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-3 py-1 rounded-full font-bold animate-pulse">
              WAITING
            </div>
          </div>

          {tournament.description && (
            <p className="text-gray-300 mb-6">{tournament.description}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <p className="text-xs text-emerald-300">Prize Pool</p>
              </div>
              <p className="text-2xl font-bold text-emerald-400">
                ${parseFloat(tournament.potAmount).toFixed(2)}
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-blue-400" />
                <p className="text-xs text-blue-300">Entry Fee</p>
              </div>
              <p className="text-2xl font-bold text-blue-400">
                ${parseFloat(tournament.entryFee).toFixed(2)}
              </p>
            </div>

            <div className="bg-gradient-to-br from-cyan-500/20 to-teal-600/20 border border-cyan-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <p className="text-xs text-cyan-300">Players</p>
              </div>
              <p className="text-2xl font-bold text-cyan-400">
                {tournament.currentParticipants}/{tournament.maxParticipants}
              </p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-yellow-500" />
              <h2 className="text-xl font-bold text-white">
                {tournament.currentParticipants >= tournament.maxParticipants 
                  ? "Tournament Full - Starting Soon!" 
                  : "Waiting for Players"}
              </h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              {tournament.currentParticipants >= tournament.maxParticipants
                ? "All players have joined! The tournament will start automatically any moment now."
                : `Waiting for ${tournament.maxParticipants - tournament.currentParticipants} more ${tournament.maxParticipants - tournament.currentParticipants === 1 ? 'player' : 'players'} to join. The tournament will start automatically when full.`}
            </p>
            {isUserParticipant && (
              <button
                onClick={() => leaveTournament.mutate()}
                disabled={leaveTournament.isPending}
                className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                {leaveTournament.isPending ? "Leaving..." : "Leave Tournament"}
              </button>
            )}
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-bold text-white">
                Participants ({participants?.length || 0})
              </h2>
            </div>
            <div className="space-y-2">
              {participants && participants.length > 0 ? (
                participants.map((participant, index) => (
                  <div
                    key={participant.id}
                    className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {participant.profileImageUrl ? (
                        <img
                          src={participant.profileImageUrl}
                          alt={participant.username}
                          className="w-10 h-10 rounded-full object-cover border-2 border-blue-500"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {participant.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-white font-medium">
                        {participant.username}
                      </span>
                    </div>
                    {participant.userId === user?.id && (
                      <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-4">
                  No participants yet. Be the first to join!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
