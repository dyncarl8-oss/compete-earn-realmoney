import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { GameInvitation } from "@/hooks/use-invitations";
import { useQueryClient } from "@tanstack/react-query";

interface GameUpdate {
  type: "game_update" | "winner_announced" | "player_forfeited" | "game_state" | "authenticated" | "authentication_failed" | "invitations" | "invitation_received" | "ai_action" | "balance_update";
  data: any;
}

// Singleton WebSocket connection to prevent multiple connections per tab
let globalWs: WebSocket | null = null;
let connectionListeners = new Set<(connected: boolean) => void>();
let messageListeners = new Set<(update: GameUpdate) => void>();
let invitationListeners = new Set<(invitation: GameInvitation) => void>();
let balanceUpdateListeners = new Set<(data: any) => void>();
let currentGameId: string | null = null;
let currentUserId: string | null = null;
let currentUsername: string | null = null;
let isAuthenticated = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function createGlobalWebSocket() {
  if (globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  globalWs = new WebSocket(wsUrl);

  globalWs.onopen = () => {
    console.log("Global WebSocket connected");
    reconnectAttempts = 0;
    connectionListeners.forEach(listener => listener(true));
    
    // Rejoin current game room if we have one
    if (currentGameId && globalWs) {
      globalWs.send(JSON.stringify({
        type: "join_game_room",
        gameId: currentGameId,
      }));
    }
  };

  globalWs.onmessage = (event) => {
    try {
      const update: GameUpdate = JSON.parse(event.data);
      
      // Handle authentication responses
      if (update.type === "authenticated") {
        isAuthenticated = true;
        console.log("WebSocket authenticated:", update.data);
      } else if (update.type === "authentication_failed") {
        isAuthenticated = false;
        console.error("WebSocket authentication failed:", update.data);
      } else if (update.type === "invitation_received") {
        // Handle real-time invitation notifications
        invitationListeners.forEach(listener => listener(update.data));
      } else if (update.type === "invitations") {
        // Handle bulk invitations data
        const invitations = update.data;
        if (Array.isArray(invitations)) {
          invitations.forEach(invitation => {
            invitationListeners.forEach(listener => listener(invitation));
          });
        }
      } else if (update.type === "balance_update") {
        // Handle real-time balance updates
        balanceUpdateListeners.forEach(listener => listener(update.data));
      }
      
      messageListeners.forEach(listener => listener(update));
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  };

  globalWs.onclose = () => {
    console.log("Global WebSocket disconnected");
    connectionListeners.forEach(listener => listener(false));
    
    // Attempt to reconnect if we haven't exceeded max attempts
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(`Attempting WebSocket reconnect ${reconnectAttempts}/${maxReconnectAttempts}`);
      setTimeout(createGlobalWebSocket, 2000 * reconnectAttempts); // Exponential backoff
    }
  };

  globalWs.onerror = (error) => {
    console.error("Global WebSocket error:", error);
    connectionListeners.forEach(listener => listener(false));
  };
}

export function useGameWebSocket(gameId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<GameUpdate | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const locationRef = useRef(setLocation);
  
  // Keep refs updated without triggering reconnections
  toastRef.current = toast;
  locationRef.current = setLocation;

  useEffect(() => {
    // Connection listener for this hook instance
    const connectionListener = (connected: boolean) => {
      setIsConnected(connected);
    };
    
    // Message listener for this hook instance
    const messageListener = (update: GameUpdate) => {
      setLastUpdate(update);
      
      // Handle specific update types with stable references
      if (update.type === "winner_announced") {
        toastRef.current({
          title: "🎉 Winner Announced!",
          description: `${update.data.winner.username} won ${update.data.gameName} and received $${update.data.prizeAmount}!`,
          duration: 5000,
        });
        
        // Simple refresh to results page when winner is announced
        if (gameId) {
          setTimeout(() => {
            window.location.href = `/results/${gameId}`;
          }, 2000); // Small delay to show the toast
        }
      } else if (update.type === "ai_action") {
        // Handle AI action messages for visual feedback
        // These will be handled by individual components that subscribe to lastUpdate
        console.log(`AI Action: ${update.data.playerName} - ${update.data.message}`);
      } else if (update.type === "player_forfeited") {
        toastRef.current({
          title: "⚠️ Player Forfeited",
          description: `${update.data.forfeitedPlayer.username} has forfeited the game.`,
          duration: 4000,
          variant: "destructive"
        });
        
        // Check game state after forfeit to see if we should refresh to results
        if (gameId) {
          setTimeout(async () => {
            try {
              const response = await fetch(`/api/games/${gameId}`);
              if (response.ok) {
                const game = await response.json();
                if (game.status === "completed") {
                  // Game completed due to forfeit, simple refresh to results page
                  window.location.href = `/results/${gameId}`;
                }
              }
            } catch (error) {
              console.error("Failed to check game status after forfeit:", error);
            }
          }, 1000); // Small delay to ensure server has processed the forfeit
        }
      }
    };
    
    // Register listeners
    connectionListeners.add(connectionListener);
    messageListeners.add(messageListener);
    
    // Update current game ID and create/reuse global connection
    if (gameId) {
      currentGameId = gameId;
      createGlobalWebSocket();
      
      // If already connected, send join message
      if (globalWs && globalWs.readyState === WebSocket.OPEN) {
        globalWs.send(JSON.stringify({
          type: "join_game_room",
          gameId,
        }));
        setIsConnected(true);
      }
    } else {
      // Leave current game room if switching to null gameId
      if (currentGameId && globalWs && globalWs.readyState === WebSocket.OPEN) {
        globalWs.send(JSON.stringify({
          type: "leave_game_room",
          gameId: currentGameId,
        }));
      }
      currentGameId = null;
    }

    return () => {
      // Unregister listeners
      connectionListeners.delete(connectionListener);
      messageListeners.delete(messageListener);
      
      // If this was the last listener and we have a game ID, leave the room
      if (gameId && messageListeners.size === 0 && globalWs && globalWs.readyState === WebSocket.OPEN) {
        globalWs.send(JSON.stringify({
          type: "leave_game_room",
          gameId,
        }));
        currentGameId = null;
      }
    };
  }, [gameId]); // Only depend on gameId, not toast!

  const sendMessage = (message: any) => {
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify(message));
    }
  };

  return {
    isConnected,
    lastUpdate,
    sendMessage,
  };
}

// Authentication functions for WebSocket
export function authenticateWebSocket(userId: string, username: string) {
  currentUserId = userId;
  currentUsername = username;
  
  if (globalWs && globalWs.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify({
      type: "authenticate",
      userId,
      username,
    }));
  }
}

// Hook for managing invitation notifications
export function useInvitationNotifications() {
  const [newInvitation, setNewInvitation] = useState<GameInvitation | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const invitationListener = (invitation: GameInvitation) => {
      // Show toast notification for new invitation
      toast({
        title: "🎲 New Game Invitation!",
        description: `${invitation.sender?.username || "Someone"} invited you to join ${invitation.game?.name || "a game"}`,
        duration: 5000,
      });
      
      // Set the new invitation for UI components to handle
      setNewInvitation(invitation);
    };

    invitationListeners.add(invitationListener);

    // Initialize WebSocket if not already done
    createGlobalWebSocket();

    return () => {
      invitationListeners.delete(invitationListener);
    };
  }, [toast]);

  const clearInvitation = () => {
    setNewInvitation(null);
  };

  return {
    newInvitation,
    clearInvitation,
  };
}

// Hook for managing balance updates
export function useBalanceUpdates(userId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const balanceUpdateListener = (data: any) => {
      // Only invalidate if this update is for the current user
      if (!userId || data.userId === userId) {
        console.log(`💰 Balance updated: $${data.balance}`);
        
        // Invalidate all user-related queries to trigger refetch
        queryClient.invalidateQueries({ queryKey: ["/api/user", data.userId] });
        queryClient.invalidateQueries({ queryKey: ["/api/whop/user"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user", data.userId, "transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user", data.userId, "withdrawals"] });
      }
    };

    balanceUpdateListeners.add(balanceUpdateListener);

    // Initialize WebSocket if not already done
    createGlobalWebSocket();

    return () => {
      balanceUpdateListeners.delete(balanceUpdateListener);
    };
  }, [userId, queryClient]);
}