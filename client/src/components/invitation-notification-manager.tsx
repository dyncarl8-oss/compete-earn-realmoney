import { useEffect, useState } from "react";
import { useWhopUser } from "@/hooks/use-whop-user";
import { useInvitationNotifications, authenticateWebSocket } from "@/hooks/use-websocket";
import { useInvitations, type GameInvitation } from "@/hooks/use-invitations";
import InvitationNotification from "@/components/invitation-notification";

export default function InvitationNotificationManager() {
  const { data: user } = useWhopUser();
  const { newInvitation, clearInvitation } = useInvitationNotifications();
  const { acceptInvitation, declineInvitation, invitations } = useInvitations();
  const [shownInvitations, setShownInvitations] = useState<Set<string>>(new Set());
  const [fallbackInvitation, setFallbackInvitation] = useState<GameInvitation | null>(null);

  // Authenticate WebSocket when user is available
  useEffect(() => {
    if (user?.id && user?.username) {
      authenticateWebSocket(user.id, user.username);
    }
  }, [user?.id, user?.username]);

  // FALLBACK: Show invitations via polling when WebSocket fails
  useEffect(() => {
    if (invitations && invitations.length > 0) {
      // Check for new pending invitations that we haven't shown yet
      const newPendingInvitations = invitations.filter(
        inv => inv.status === "pending" && !shownInvitations.has(inv.id)
      );

      if (newPendingInvitations.length > 0) {
        // Show the first new invitation
        const invitationToShow = newPendingInvitations[0];
        setFallbackInvitation(invitationToShow);
        setShownInvitations(prev => new Set([...prev, invitationToShow.id]));
      }
    }
  }, [invitations, shownInvitations]);

  const handleAccept = async (invitationId: string) => {
    await acceptInvitation(invitationId);
    clearInvitation();
    setFallbackInvitation(null);
  };

  const handleDecline = async (invitationId: string) => {
    await declineInvitation(invitationId);
    clearInvitation();
    setFallbackInvitation(null);
  };

  const handleClose = () => {
    clearInvitation();
    setFallbackInvitation(null);
  };

  // Show WebSocket notification if available, otherwise show fallback
  const invitationToShow = newInvitation || fallbackInvitation;
  
  if (!invitationToShow) {
    return null;
  }

  return (
    <InvitationNotification
      invitation={invitationToShow}
      onAccept={handleAccept}
      onDecline={handleDecline}
      onClose={handleClose}
      isOpen={true}
    />
  );
}