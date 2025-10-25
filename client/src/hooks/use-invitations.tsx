import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export interface GameInvitation {
  id: string;
  gameId: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: string;
  respondedAt?: string;
  expiresAt: string;
  game?: {
    id: string;
    name: string;
    entryFee: string;
    maxPlayers: number;
    currentPlayers: number;
    status: string;
  };
  sender?: {
    id: string;
    username: string;
    profileImageUrl?: string;
  };
}

export function useInvitations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all invitations
  const {
    data: invitations = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ["invitations"],
    queryFn: async (): Promise<GameInvitation[]> => {
      const response = await fetch("/api/invitations", {
        credentials: "include", // Include auth cookies
      });
      if (!response.ok) {
        throw new Error("Failed to fetch invitations");
      }
      return response.json();
    },
    refetchInterval: 10000, // Reduced from 3s to 10s for better performance with Firestore
    refetchOnWindowFocus: true, // Check immediately when user returns to tab
    refetchOnMount: true, // Check immediately when component mounts
  });

  // Get pending invitations only
  const pendingInvitations = invitations.filter(inv => inv.status === "pending");

  // Accept invitation
  const acceptInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/invitations/${invitationId}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to accept invitation");
      }

      const result = await response.json();
      
      // Refresh invitations data
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["user", "active-game"] });

      toast({
        title: "Invitation Accepted!",
        description: "You've successfully joined the game",
      });

      return result;
    } catch (error) {
      toast({
        title: "Failed to Accept Invitation",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Decline invitation
  const declineInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/invitations/${invitationId}/decline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to decline invitation");
      }

      // Refresh invitations data
      queryClient.invalidateQueries({ queryKey: ["invitations"] });

      toast({
        title: "Invitation Declined",
        description: "You've declined the game invitation",
      });
    } catch (error) {
      toast({
        title: "Failed to Decline Invitation",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    invitations,
    pendingInvitations,
    isLoading,
    error,
    acceptInvitation,
    declineInvitation,
  };
}