import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Clock, Users, DollarSign, CheckCircle, X, User } from "lucide-react";
import { GameInvitation } from "@/hooks/use-invitations";

interface InvitationNotificationProps {
  invitation: GameInvitation;
  onAccept: (invitationId: string) => Promise<void>;
  onDecline: (invitationId: string) => Promise<void>;
  onClose: () => void;
  isOpen: boolean;
}

export default function InvitationNotification({
  invitation,
  onAccept,
  onDecline,
  onClose,
  isOpen
}: InvitationNotificationProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleAccept = async () => {
    try {
      setIsProcessing(true);
      await onAccept(invitation.id);
      onClose();
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    try {
      setIsProcessing(true);
      await onDecline(invitation.id);
      onClose();
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsProcessing(false);
    }
  };

  const timeUntilExpiry = () => {
    const now = new Date();
    const expiry = new Date(invitation.expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins <= 0) return "Expired";
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-bold flex items-center space-x-3">
            <Users className="w-6 h-6 text-violet-400" />
            <span>Game Invitation</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Sender Info */}
          <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-500/20 to-cyan-600/20 border border-blue-500/30 rounded-xl">
            <Avatar className="w-12 h-12">
              <AvatarImage src={invitation.sender?.profileImageUrl} alt={invitation.sender?.username} />
              <AvatarFallback className="bg-slate-700 text-slate-300">
                {invitation.sender?.username?.slice(0, 2).toUpperCase() || <User className="w-5 h-5" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-white font-semibold">{invitation.sender?.username || "Unknown Player"}</p>
              <p className="text-blue-300 text-sm">invited you to join</p>
            </div>
          </div>

          {/* Game Info */}
          {invitation.game && (
            <Card className="bg-slate-800/50 border-slate-600">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold text-lg">{invitation.game.name}</h3>
                  <Badge 
                    variant="secondary" 
                    className="bg-green-500/20 text-green-300 border-green-500/30"
                  >
                    {invitation.game.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center space-x-2 text-slate-300">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <span>Entry: ${invitation.game.entryFee}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-300">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>{invitation.game.currentPlayers}/{invitation.game.maxPlayers} players</span>
                  </div>
                </div>

                {invitation.message && (
                  <div className="mt-3 p-3 bg-slate-700/50 rounded-lg">
                    <p className="text-slate-300 text-sm italic">"{invitation.message}"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Expiry Info */}
          <div className="flex items-center justify-center space-x-2 text-slate-400 text-sm">
            <Clock className="w-4 h-4" />
            <span>Expires in {timeUntilExpiry()}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              onClick={handleDecline}
              disabled={isProcessing}
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <X className="w-4 h-4 mr-2" />
              Decline
            </Button>
            <Button
              onClick={handleAccept}
              disabled={isProcessing}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {isProcessing ? "Joining..." : "Accept & Join"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}