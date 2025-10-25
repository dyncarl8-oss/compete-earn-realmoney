import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Search, Users, Link, Send, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnlinePlayer {
  id: string;
  username: string;
  profileImageUrl?: string;
  status: "online" | "in-game" | "away";
  lastSeen?: Date;
}

interface InvitePlayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
  shareUrl: string;
}

export default function InvitePlayersModal({
  isOpen,
  onClose,
  gameId,
  gameName,
  shareUrl
}: InvitePlayersModalProps) {
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [invitedPlayers, setInvitedPlayers] = useState<Set<string>>(new Set());
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  // Fetch online players when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchOnlinePlayers();
    }
  }, [isOpen]);

  const fetchOnlinePlayers = async () => {
    try {
      setIsLoadingPlayers(true);
      const response = await fetch("/api/players/online");
      if (response.ok) {
        const players = await response.json();
        setOnlinePlayers(players);
      }
    } catch (error) {
      console.error("Failed to fetch online players:", error);
      // Mock data for development - remove when API is implemented
      setOnlinePlayers([
        {
          id: "player-1",
          username: "AliceGamer",
          profileImageUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=60&h=60",
          status: "online"
        },
        {
          id: "player-2", 
          username: "BobRoller",
          profileImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=60&h=60",
          status: "online"
        },
        {
          id: "player-3",
          username: "CarolDice",
          profileImageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=60&h=60", 
          status: "in-game"
        },
        {
          id: "player-4",
          username: "DavePlayer",
          profileImageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=60&h=60",
          status: "online"
        },
        {
          id: "player-5",
          username: "EveChampion", 
          profileImageUrl: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=60&h=60",
          status: "away"
        }
      ]);
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  const filteredPlayers = onlinePlayers.filter(player =>
    player.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInvitePlayer = async (playerId: string, username: string) => {
    try {
      const response = await fetch("/api/games/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId,
          playerId,
          message: `Join me in ${gameName}! 🎲`
        }),
      });

      if (response.ok) {
        setInvitedPlayers(prev => new Set(Array.from(prev).concat(playerId)));
        toast({
          title: "Invitation Sent!",
          description: `Invited ${username} to join your game`,
        });
      } else {
        throw new Error("Failed to send invitation");
      }
    } catch (error) {
      toast({
        title: "Failed to Send Invitation",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      toast({
        title: "Link Copied!",
        description: "Share this link with friends to invite them to play",
      });
      
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      toast({
        title: "Failed to Copy Link",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "in-game":
        return "bg-yellow-500";
      case "away":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "online":
        return "Online";
      case "in-game":
        return "In Game";
      case "away":
        return "Away";
      default:
        return "Offline";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-bold flex items-center space-x-3">
            <Users className="w-6 h-6 text-violet-400" />
            <span>Invite Players to {gameName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Share Link Section */}
          <div className="bg-gradient-to-r from-blue-500/20 to-cyan-600/20 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center space-x-3 mb-3">
              <Link className="w-5 h-5 text-blue-400" />
              <h3 className="text-blue-300 font-semibold">Share Game Link</h3>
            </div>
            <div className="flex space-x-2">
              <Input
                value={shareUrl}
                readOnly
                className="flex-1 bg-slate-700 border-slate-600 text-slate-300 text-sm"
              />
              <Button
                onClick={handleCopyShareLink}
                className={cn(
                  "transition-all duration-200",
                  isCopied
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {isCopied ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-slate-400 text-xs mt-2">
              Share this link with friends who don't have an account yet
            </p>
          </div>

          {/* Online Players Section */}
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <Users className="w-5 h-5 text-violet-400" />
              <h3 className="text-white font-semibold">Invite Online Players</h3>
              <Badge variant="secondary" className="bg-violet-500/20 text-violet-300">
                {filteredPlayers.length} online
              </Badge>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-700 border-slate-600 text-white"
              />
            </div>

            {/* Players List */}
            <div className="max-h-60 overflow-y-auto space-y-2">
              {isLoadingPlayers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-400"></div>
                  <span className="ml-3 text-slate-400">Loading players...</span>
                </div>
              ) : filteredPlayers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-400">No players found</p>
                </div>
              ) : (
                filteredPlayers.map((player) => {
                  const isInvited = invitedPlayers.has(player.id);
                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={player.profileImageUrl} alt={player.username} />
                            <AvatarFallback className="bg-slate-700 text-slate-300 text-sm">
                              {player.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className={cn(
                            "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-800",
                            getStatusColor(player.status)
                          )} />
                        </div>
                        <div>
                          <p className="text-white font-medium">{player.username}</p>
                          <p className="text-slate-400 text-xs">{getStatusText(player.status)}</p>
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => handleInvitePlayer(player.id, player.username)}
                        disabled={isInvited || player.status === "in-game"}
                        size="sm"
                        className={cn(
                          "transition-all duration-200",
                          isInvited
                            ? "bg-green-600 hover:bg-green-700"
                            : player.status === "in-game"
                            ? "bg-gray-600 opacity-50 cursor-not-allowed"
                            : "bg-violet-600 hover:bg-violet-700"
                        )}
                      >
                        {isInvited ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Invited
                          </>
                        ) : player.status === "in-game" ? (
                          "In Game"
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-1" />
                            Invite
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}