import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useYahtzeeGameState, useCurrentTurn, useRollDice, useHoldDice, useScoreCategory } from "@/hooks/use-yahtzee";
import { useLeaveGame } from "@/hooks/use-games";
import { useWhopUser } from "@/hooks/use-whop-user";
import { useToast } from "@/hooks/use-toast";
import { useGameWebSocket } from "@/hooks/use-websocket";
import { Users, Crown, Loader2, Clock, HelpCircle, LogOut } from "lucide-react";
import Dice3D from "@/components/ui/dice-3d";
import GameTable from "@/components/ui/game-table";
import PlayerProfile from "@/components/ui/player-profile";
import { 
  calculatePlayerPositions, 
  getDiceDisplayConfig, 
  getDiceAnimationDirection,
  getPlayerAnchorOffset,
  getPlayerDiceBasePosition,
  computeScatterPositions,
  computeParkedDicePositions,
  computeHeldDicePositions,
  generateScatterSeed,
  DicePhase,
  type TablePosition
} from "@/lib/player-positioning";
import { cn, playRollingSound } from "@/lib/utils";

interface YahtzeeGameProps {
  gameId: string;
  onBackToLobby?: () => void;
}


// Complete Yahtzee categories - Upper and Lower sections
const upperSectionCategories = [
  { key: 'ones', label: 'Ones', description: 'Count and add only 1s' },
  { key: 'twos', label: 'Twos', description: 'Count and add only 2s' },
  { key: 'threes', label: 'Threes', description: 'Count and add only 3s' },
  { key: 'fours', label: 'Fours', description: 'Count and add only 4s' },
  { key: 'fives', label: 'Fives', description: 'Count and add only 5s' },
  { key: 'sixes', label: 'Sixes', description: 'Count and add only 6s' },
];

const lowerSectionCategories = [
  { key: 'threeOfAKind', label: '3 of a Kind', description: 'Sum of all dice' },
  { key: 'fourOfAKind', label: '4 of a Kind', description: 'Sum of all dice' },
  { key: 'fullHouse', label: 'Full House', description: '25 points' },
  { key: 'smallStraight', label: 'Small Straight', description: '30 points' },
  { key: 'largeStraight', label: 'Large Straight', description: '40 points' },
  { key: 'yahtzee', label: 'Yahtzee', description: '50 points' },
  { key: 'chance', label: 'Chance', description: 'Sum of all dice' },
];

const scoringCategories = [...upperSectionCategories, ...lowerSectionCategories];

export default function YahtzeeGame({ gameId, onBackToLobby }: YahtzeeGameProps) {
  const [, setLocation] = useLocation();
  const { user: whopUser, isLoading: whopUserLoading, isInWhopIframe } = useWhopUser();
  
  // Ref to track previous rollCount for sound effects
  const prevRollCountRef = useRef<number>(0);
  const prevPlayerIdRef = useRef<string | null>(null);
  
  // Get the game state (polling auto-stops when completed)
  const { data: gameState, isLoading: gameStateLoading } = useYahtzeeGameState(gameId);
  const isGameCompleted = gameState?.game.status === "completed";
  
  // Use conditional polling for current turn (stops when game completed)
  const { data: currentTurn, isLoading: currentTurnLoading } = useCurrentTurn(gameId, isGameCompleted);
  const rollDice = useRollDice(gameId);
  const holdDice = useHoldDice(gameId);
  const scoreCategory = useScoreCategory(gameId);
  const leaveGame = useLeaveGame();
  const { toast } = useToast();
  const [chatBubbles, setChatBubbles] = useState<Record<string, { message: string; visible: boolean; type: 'category' | 'action' | 'info' }>>({});
  
  // Connect to WebSocket for real-time game updates and forfeit notifications
  const { isConnected: wsConnected, lastUpdate: wsUpdate } = useGameWebSocket(gameId);
  
  // Dice positioning state
  const [dicePhase, setDicePhase] = useState<DicePhase>('parked');
  const [scatterPositions, setScatterPositions] = useState<Array<{ x: number; y: number; rotation: number }>>([]);
  const [heldDicePositions, setHeldDicePositions] = useState<Array<{ x: number; y: number; rotation: number }>>([]);
  const [parkedDicePositions, setParkedDicePositions] = useState<Array<{ x: number; y: number; rotation: number }>>([]);

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS (React Rules of Hooks)
  // Navigate to results page when game is completed (only when not in GameRoom)
  useEffect(() => {
    if (isGameCompleted && !onBackToLobby) {
      // Only navigate directly if no callback (legacy usage)
      setLocation(`/results/${gameId}`);
    }
  }, [isGameCompleted, gameId, setLocation, onBackToLobby]);

  // Dice phase transitions based on game state
  useEffect(() => {
    if (!currentTurn || !gameState) return;
    const currentPlayer = gameState.players.find(p => p.user.id === gameState.currentTurnUserId);
    if (!currentPlayer) return;

    // When turn changes, move dice to new player's position (parked phase)
    if (dicePhase !== 'parked') {
      setDicePhase('parked');
    }
  }, [currentTurn?.userId, gameState?.currentRound, gameState, dicePhase]);

  // Generate parked dice positions when phase changes to parked
  useEffect(() => {
    if (!gameState || !currentTurn) return;
    const currentPlayer = gameState.players.find(p => p.user.id === gameState.currentTurnUserId);
    const currentUserId = whopUser?.id || gameState.currentTurnUserId || gameState.players[0]?.user.id;
    const dice = currentTurn ? [
      { value: currentTurn.dice1, held: currentTurn.hold1 },
      { value: currentTurn.dice2, held: currentTurn.hold2 },
      { value: currentTurn.dice3, held: currentTurn.hold3 },
      { value: currentTurn.dice4, held: currentTurn.hold4 },
      { value: currentTurn.dice5, held: currentTurn.hold5 },
    ] : [];
    
    if (dicePhase === 'parked' && currentPlayer && dice.length > 0 && currentUserId) {
      const positions = calculatePlayerPositions(
        gameState.players.map(p => p.user.id),
        currentUserId
      );
      const currentPlayerPos = positions.find(p => p.playerId === currentPlayer.user.id);
      if (currentPlayerPos?.position) {
        const positions = computeParkedDicePositions(dice.length, currentPlayerPos.position);
        setParkedDicePositions(positions);
      }
    }
  }, [dicePhase, gameState, currentTurn, whopUser?.id]);

  // When roll count increases, generate scatter positions and set scattered phase
  useEffect(() => {
    if (!currentTurn || !gameState) return;
    const currentPlayer = gameState.players.find(p => p.user.id === gameState.currentTurnUserId);
    if (!currentPlayer) return;

    const currentRollCount = currentTurn.rollCount || 0;
    const currentPlayerId = currentPlayer.user.id;
    const isMyTurn = gameState.currentTurnUserId === whopUser?.id;
    const dice = currentTurn ? [
      { value: currentTurn.dice1, held: currentTurn.hold1 },
      { value: currentTurn.dice2, held: currentTurn.hold2 },
      { value: currentTurn.dice3, held: currentTurn.hold3 },
      { value: currentTurn.dice4, held: currentTurn.hold4 },
      { value: currentTurn.dice5, held: currentTurn.hold5 },
    ] : [];
    
    // Reset rollCount tracking when player changes
    if (prevPlayerIdRef.current !== currentPlayerId) {
      prevRollCountRef.current = 0;
      prevPlayerIdRef.current = currentPlayerId;
    }
    
    // Skip if this is the initial state (no dice rolled yet)
    if (currentRollCount === 0) {
      prevRollCountRef.current = 0;
      return;
    }
    
    // Play rolling sound for opponent dice rolls only when rollCount actually increases
    if (!isMyTurn && currentRollCount > prevRollCountRef.current) {
      playRollingSound();
    }
    
    // Update the ref with current rollCount
    prevRollCountRef.current = currentRollCount;

    // Generate new scatter positions for non-held dice when roll completes
    const seed = generateScatterSeed(gameId, currentPlayer.user.id, currentRollCount);
    const newPositions = computeScatterPositions(dice.length, seed);
    setScatterPositions(newPositions);
    
    // Only transition to scattered if not already handling a roll (to avoid race conditions)
    if (dicePhase !== 'to-center') {
      setDicePhase('scattered');
    } else {
      // Delay the transition to scattered phase to allow center animation to be visible
      setTimeout(() => {
        setDicePhase('scattered');
      }, 300);
    }
  }, [currentTurn?.rollCount, gameId, gameState, dicePhase, whopUser?.id]);

  // Update held dice positions when dice are held/unheld
  useEffect(() => {
    if (!currentTurn || !gameState || dicePhase !== 'scattered') return;
    const currentPlayer = gameState.players.find(p => p.user.id === gameState.currentTurnUserId);
    if (!currentPlayer) return;

    const currentUserId = whopUser?.id || gameState.currentTurnUserId || gameState.players[0]?.user.id;
    if (!currentUserId) return;

    const positions = calculatePlayerPositions(
      gameState.players.map(p => p.user.id),
      currentUserId
    );
    const currentPlayerPos = positions.find(p => p.playerId === currentPlayer.user.id);
    if (!currentPlayerPos?.position) return;

    const dice = currentTurn ? [
      { value: currentTurn.dice1, held: currentTurn.hold1 },
      { value: currentTurn.dice2, held: currentTurn.hold2 },
      { value: currentTurn.dice3, held: currentTurn.hold3 },
      { value: currentTurn.dice4, held: currentTurn.hold4 },
      { value: currentTurn.dice5, held: currentTurn.hold5 },
    ] : [];
    
    const heldDice = dice.filter(die => die.held);
    if (heldDice.length > 0) {
      const heldPositions = computeHeldDicePositions(heldDice.length, currentPlayerPos.position);
      setHeldDicePositions(heldPositions);
    } else {
      setHeldDicePositions([]);
    }
  }, [currentTurn, gameState, dicePhase, whopUser?.id]);

  // Handle AI action messages from WebSocket
  useEffect(() => {
    if (wsUpdate && wsUpdate.type === 'ai_action' && wsUpdate.data.gameId === gameId) {
      const { playerId, message, action } = wsUpdate.data;
      
      // Trigger dice rolling animation for AI
      if (action === 'rolling') {
        setDicePhase('to-center');
      }
      
      // Show chat bubble for AI action
      setChatBubbles(prev => ({
        ...prev,
        [playerId]: {
          message: message,
          visible: true,
          type: action === 'scoring' ? 'category' : 'action'
        }
      }));
      
      // Hide the chat bubble after 4 seconds for AI actions
      setTimeout(() => {
        setChatBubbles(prev => ({
          ...prev,
          [playerId]: { ...prev[playerId], visible: false }
        }));
      }, 4000);
    }
  }, [wsUpdate, gameId]);


  const handleForfeit = async () => {
    if (!whopUser) return;
    
    try {
      const result = await leaveGame.mutateAsync({ gameId });
      
      toast({
        title: "Game Forfeited",
        description: "Returning to lobby...",
        variant: "destructive"
      });

      // Simple refresh to lobby - this always works reliably
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (error) {
      toast({
        title: "Failed to Forfeit", 
        description: "Could not forfeit the game. Please try again.",
        variant: "destructive"
      });
      // Still refresh to lobby even on error
      window.location.href = '/';
    }
  };

  // DEBUG: Log loading states
  console.log("🎮 YahtzeeGame Loading States:", {
    whopUserLoading,
    gameStateLoading,
    hasGameState: !!gameState,
    isInWhopIframe,
    hasWhopUser: !!whopUser,
    gameStatus: gameState?.game?.status,
    playerCount: gameState?.players?.length
  });

  // Critical: Wait for Whop user to load when in Whop iframe
  // This prevents blank page issues when auth is still loading
  if (whopUserLoading || gameStateLoading || !gameState) {
    console.log("⏳ YahtzeeGame in loading state");
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-slate-400">
            {whopUserLoading ? "Authenticating..." : "Loading Yahtzee game..."}
          </span>
        </div>
      </div>
    );
  }
  
  // Critical: If in Whop iframe but no user loaded, show authentication error
  if (isInWhopIframe && !whopUser) {
    console.error("❌ YahtzeeGame: In Whop iframe but no user loaded");
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="bg-slate-800/50 border-red-700 max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl text-red-400">⚠️ Authentication Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-slate-300 mb-4">
              Unable to authenticate your Whop account. Please refresh the page or contact support if this persists.
            </p>
            <Button 
              className="w-full" 
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // DEBUG: Log game state and validate data integrity
  console.log("🎲 Yahtzee Game State:", {
    status: gameState.game.status,
    playerCount: gameState.players.length,
    players: gameState.players.map((p, idx) => ({ 
      index: idx,
      hasUser: !!p.user,
      userId: p.user?.id,
      username: p.user?.username, 
      hasState: !!p.state 
    })),
    currentUserId: whopUser?.id,
    currentTurnUserId: gameState.currentTurnUserId
  });

  // Critical: Check if any player has null/undefined user data
  const invalidPlayers = gameState.players.filter(p => !p.user || !p.user.id);
  if (invalidPlayers.length > 0) {
    console.error("❌ YahtzeeGame: Found players with invalid user data!", {
      invalidPlayers,
      totalPlayers: gameState.players.length,
      allPlayers: gameState.players
    });
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="bg-slate-800/50 border-red-700 max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl text-red-400">⚠️ Data Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-slate-300 mb-2">
              There's a problem loading player data. Please refresh the page.
            </p>
            <p className="text-xs text-slate-400 text-center mb-4">
              Error: {invalidPlayers.length} player(s) missing user data
            </p>
            <Button 
              className="w-full" 
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle "waiting" status - game is full but hasn't started yet
  if (gameState.game.status === "waiting") {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">🎲 Game Starting Soon!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-slate-300">
              The table is full! The game will start automatically in a moment...
            </p>
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-slate-400">Initializing game...</span>
            </div>
            <div className="pt-4 border-t border-slate-700">
              <p className="text-sm text-slate-400 text-center mb-3">Players:</p>
              <div className="space-y-2">
                {gameState.players.map(player => (
                  <div key={player.user.id} className="flex items-center justify-center gap-2 text-slate-300">
                    <span className="font-semibold">{player.user.username}</span>
                    {player.user.id === whopUser?.id && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">You</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle race condition: game is "running" but player states not yet initialized
  // This can happen during the brief window when the game starts
  const hasPlayerStates = gameState.players.some(p => p.state !== null);
  console.log("🎲 YahtzeeGame Player States Check:", {
    status: gameState.game.status,
    hasPlayerStates,
    playersWithStates: gameState.players.filter(p => p.state !== null).length,
    totalPlayers: gameState.players.length
  });
  
  if (gameState.game.status === "running" && !hasPlayerStates) {
    console.log("⏳ YahtzeeGame: Waiting for player states to initialize");
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">🎲 Game Starting!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-slate-300">
              Setting up the game board...
            </p>
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-slate-400">Preparing scorecards...</span>
            </div>
            <div className="pt-4 border-t border-slate-700">
              <p className="text-sm text-slate-400 text-center mb-3">Players:</p>
              <div className="space-y-2">
                {gameState.players.map(player => (
                  <div key={player.user.id} className="flex items-center justify-center gap-2 text-slate-300">
                    <span className="font-semibold">{player.user.username}</span>
                    {player.user.id === whopUser?.id && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">You</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle case where game is running but current turn is still initializing
  // This can happen briefly during tournament game start due to async initialization
  if (gameState.game.status === "running" && (currentTurnLoading || !currentTurn)) {
    console.log("⏳ YahtzeeGame: Waiting for current turn to initialize");
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">🎲 Initializing Turn...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-slate-300">
              Setting up the dice...
            </p>
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-slate-400">Loading game state...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Game completion is handled by useEffect navigation above
  // Show loading state while navigating to prevent rendering errors
  if (isGameCompleted) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">🎉 Game Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-slate-300">
              Loading final results...
            </p>
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-slate-400">Calculating scores...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPlayer = gameState.players.find(p => p.user.id === gameState.currentTurnUserId);
  const myPlayerState = gameState.players.find(p => p.user.id === whopUser?.id);
  const isMyTurn = gameState.currentTurnUserId === whopUser?.id;

  // Guard: If we can't find the current user's player state, show loading
  // This can happen when Whop user data is still loading or game is not running yet
  if (!myPlayerState && whopUser && gameState.game.status === "running") {
    console.error("❌ YahtzeeGame: Cannot find current user in players list", {
      whopUserId: whopUser.id,
      playerIds: gameState.players.map(p => p.user.id),
      allPlayers: gameState.players
    });
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-slate-400">Loading player data...</span>
        </div>
      </div>
    );
  }
  
  console.log("✅ YahtzeeGame: Rendering game board", {
    status: gameState.game.status,
    currentPlayer: currentPlayer?.user.username,
    myUsername: myPlayerState?.user.username,
    isMyTurn
  });

  // Calculate player positions around the table
  // Use fallback positioning for development/unauthenticated sessions
  const currentUserId = whopUser?.id || gameState.currentTurnUserId || gameState.players[0]?.user.id;
  const playerPositions = currentUserId ? calculatePlayerPositions(
    gameState.players.map(p => p.user.id),
    currentUserId
  ) : [];

  // Get dice display configuration
  const diceConfig = getDiceDisplayConfig(5);

  // Get current player's position for dice animation
  const currentPlayerPosition = playerPositions.find(pos => pos.playerId === gameState.currentTurnUserId);
  const diceAnimationClass = currentPlayerPosition ? getDiceAnimationDirection(currentPlayerPosition.position) : '';
  
  const dice = currentTurn ? [
    { value: currentTurn.dice1, held: currentTurn.hold1 },
    { value: currentTurn.dice2, held: currentTurn.hold2 },
    { value: currentTurn.dice3, held: currentTurn.hold3 },
    { value: currentTurn.dice4, held: currentTurn.hold4 },
    { value: currentTurn.dice5, held: currentTurn.hold5 },
  ] : [];

  const handleRollDice = async () => {
    if (!isMyTurn || rollDice.isPending) return;
    
    // Play rolling sound
    playRollingSound();
    
    // Set dice phase to center during rolling
    setDicePhase('to-center');
    
    try {
      await rollDice.mutateAsync();
      // Keep dice in center for a moment so animation is visible
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (error) {
      toast({
        title: "Roll failed",
        description: "Failed to roll dice. Please try again.",
        variant: "destructive",
      });
      // Reset to parked phase on error
      setDicePhase('parked');
    }
  };

  const handleHoldDice = async (diceIndex: number) => {
    if (!isMyTurn || !currentTurn || holdDice.isPending) return;
    
    const currentlyHeld = [currentTurn.hold1, currentTurn.hold2, currentTurn.hold3, currentTurn.hold4, currentTurn.hold5][diceIndex];
    
    try {
      await holdDice.mutateAsync({ diceIndex, hold: !currentlyHeld });
    } catch (error) {
      toast({
        title: "Hold failed",
        description: "Failed to hold dice. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleImmediateScore = async (categoryKey: string) => {
    if (!isMyTurn || scoreCategory.isPending) return;
    
    try {
      const categoryLabel = scoringCategories.find(c => c.key === categoryKey)?.label || categoryKey;
      
      // Show chat bubble for the category announcement
      if (whopUser) {
        setChatBubbles(prev => ({
          ...prev,
          [whopUser.id]: {
            message: `Scored ${categoryLabel}!`,
            visible: true,
            type: 'category'
          }
        }));
        
        // Hide the chat bubble after 3 seconds
        setTimeout(() => {
          setChatBubbles(prev => ({
            ...prev,
            [whopUser.id]: { ...prev[whopUser.id], visible: false }
          }));
        }, 3000);
      }
      
      await scoreCategory.mutateAsync({ category: categoryKey });
      toast({
        title: "Category scored!",
        description: "Your turn has been completed.",
      });
    } catch (error) {
      toast({
        title: "Scoring failed",
        description: "Failed to score category. Please try again.",
        variant: "destructive",
      });
    }
  };

  const calculatePotentialScore = (category: string): number => {
    if (!currentTurn) return 0;
    
    const diceValues = [currentTurn.dice1, currentTurn.dice2, currentTurn.dice3, currentTurn.dice4, currentTurn.dice5];
    const counts = diceValues.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const sortedCounts = Object.values(counts).sort((a, b) => b - a);
    const sum = diceValues.reduce((a, b) => a + b, 0);

    switch (category) {
      // Upper Section Categories
      case 'ones': return (counts[1] || 0) * 1;
      case 'twos': return (counts[2] || 0) * 2;
      case 'threes': return (counts[3] || 0) * 3;
      case 'fours': return (counts[4] || 0) * 4;
      case 'fives': return (counts[5] || 0) * 5;
      case 'sixes': return (counts[6] || 0) * 6;
      
      // Lower Section Categories
      case 'threeOfAKind': return sortedCounts[0] >= 3 ? sum : 0;
      case 'fourOfAKind': return sortedCounts[0] >= 4 ? sum : 0;
      case 'fullHouse': return sortedCounts[0] === 3 && sortedCounts[1] === 2 ? 25 : 0;
      case 'smallStraight': {
        const uniqueDice = Array.from(new Set(diceValues)).sort();
        const straights = [[1,2,3,4], [2,3,4,5], [3,4,5,6]];
        return straights.some(straight => straight.every(num => uniqueDice.includes(num))) ? 30 : 0;
      }
      case 'largeStraight': {
        const uniqueDice = Array.from(new Set(diceValues)).sort();
        return (uniqueDice.join('') === '12345' || uniqueDice.join('') === '23456') ? 40 : 0;
      }
      case 'yahtzee': return sortedCounts[0] === 5 ? 50 : 0;
      case 'chance': return sum;
      default: return 0;
    }
  };

  // Calculate dynamic layout based on number of players
  const playerCount = gameState.players.length;
  
  // Perfect dynamic layout that scales with player count
  const getGridClasses = () => {
    if (playerCount <= 2) {
      return "grid grid-cols-1 lg:grid-cols-10 gap-4"; // 8 cols table + 2 cols scorecard
    } else if (playerCount === 3) {
      return "grid grid-cols-1 lg:grid-cols-10 gap-4"; // 7 cols table + 3 cols scorecard  
    } else if (playerCount === 4) {
      return "grid grid-cols-1 lg:grid-cols-10 gap-4"; // 6 cols table + 4 cols scorecard
    } else {
      return "grid grid-cols-1 lg:grid-cols-10 gap-4"; // 5 cols table + 5 cols scorecard (5+ players)
    }
  };
  
  const getTableCols = () => {
    if (playerCount <= 2) return "lg:col-span-8";
    if (playerCount === 3) return "lg:col-span-7";
    if (playerCount === 4) return "lg:col-span-7";
    return "lg:col-span-7"; // 5+ players - more space for table
  };
  
  const getScorecardCols = () => {
    if (playerCount <= 2) return "lg:col-span-2";
    if (playerCount === 3) return "lg:col-span-3";
    if (playerCount === 4) return "lg:col-span-3";
    return "lg:col-span-3"; // 5+ players - more compact
  };

  return (
    <div className="p-4">
      {/* Main Game Layout: Table on Left, Scorecard on Right */}
      <div className={getGridClasses()}>
        {/* Game Table - Dynamic width based on player count */}
        <div className={getTableCols()}>
          <GameTable
            className="h-[550px]"
            centerContent={
              <div className="space-y-4">
                {/* Dice Display with Individual Positioning for All Phases */}
                <div className="relative w-[500px] h-60">
                  {dice.map((die, index) => {
                    let position: { x: number; y: number; rotation: number };
                    let isHeld = die.held;
                    
                    if (dicePhase === 'scattered') {
                      if (isHeld) {
                        // Find position in held dice array
                        const heldIndex = dice.slice(0, index).filter(d => d.held).length;
                        position = heldDicePositions[heldIndex] || { x: 0, y: 0, rotation: 0 };
                      } else {
                        // Use scatter position for non-held dice
                        position = scatterPositions[index] || { x: 0, y: 0, rotation: 0 };
                      }
                    } else if (dicePhase === 'parked') {
                      // Use parked position (directional positioning near player)
                      position = parkedDicePositions[index] || { x: 0, y: 0, rotation: 0 };
                    } else {
                      // to-center phase - dice at center
                      position = { x: 0, y: 0, rotation: 0 };
                    }
                    
                    return (
                      <div
                        key={index}
                        className={cn(
                          "absolute transition-all ease-out",
                          dicePhase === 'parked' ? "duration-700" : (isHeld ? "duration-500" : "duration-300")
                        )}
                        style={{
                          left: `50%`,
                          top: `50%`,
                          transform: `translate(${position.x}px, ${position.y}px) rotate(${position.rotation}deg)`,
                          transitionDelay: dicePhase === 'parked' ? `${index * 100}ms` : (isHeld ? '200ms' : `${index * 100}ms`),
                          zIndex: isHeld ? 10 : 1
                        }}
                      >
                        <Dice3D
                          value={die.value as 1 | 2 | 3 | 4 | 5 | 6}
                          held={die.held}
                          disabled={!isMyTurn || (currentTurn?.rollCount || 0) === 0}
                          onClick={() => handleHoldDice(index)}
                          isRolling={rollDice.isPending}
                          size="sm"
                          data-testid={`dice-${index}`}
                        />
                      </div>
                    );
                  })}
                </div>


                
                {!isMyTurn && (
                  <div className="text-center text-slate-300">
                    Waiting for {currentPlayer?.user.username}'s turn...
                  </div>
                )}
              </div>
            }
            playerPositions={playerPositions.map(pos => {
              const player = gameState.players.find(p => p.user.id === pos.playerId);
              const playerState = player?.state;
              const isPlayerCurrentTurn = gameState.currentTurnUserId === pos.playerId;
              const isPlayerCurrentPlayer = whopUser ? pos.isCurrentPlayer : pos.playerId === currentUserId;
              
              return {
                id: pos.playerId,
                position: pos.position,
                content: (
                  <div className="flex flex-col items-center space-y-2">
                    {/* Roll Controls - Show above current player's profile */}
                    {isPlayerCurrentPlayer && isPlayerCurrentTurn && currentTurn && (
                      <div className="flex flex-col items-center space-y-1">
                        <div className="text-xs text-slate-400">
                          Rolls: {currentTurn.rollCount || 0}/3
                        </div>
                        {(currentTurn.rollCount || 0) < 3 && (
                          <Button
                            onClick={handleRollDice}
                            disabled={rollDice.isPending || !isMyTurn}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 shadow-lg text-xs"
                            data-testid="roll-dice-button"
                          >
                            {rollDice.isPending ? (
                              <div className="flex items-center space-x-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Rolling...</span>
                              </div>
                            ) : (
                              "🎲 Roll"
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                    <PlayerProfile
                      id={pos.playerId}
                      username={player?.user.username || 'Unknown'}
                      profileImageUrl={player?.user.profileImageUrl}
                      isCurrentTurn={isPlayerCurrentTurn}
                      isCurrentPlayer={isPlayerCurrentPlayer}
                      position={pos.position}
                      chatBubble={chatBubbles[pos.playerId]}
                    />
                  </div>
                )
              };
            })}
          />
        </div>

        {/* Scorecard Table - Dynamic width based on player count */}
        <div className={cn(getScorecardCols(), "pt-8")}>
          <Card className="bg-slate-900/95 border-slate-700">
            <CardContent className="p-0">
              <div>
                <table className="w-full text-xs table-fixed">
                  {/* Table Header */}
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left p-0.5 pl-3 text-slate-300 font-medium text-xs w-16 max-w-16">Category</th>
                      {gameState.players.map((player) => (
                        <th key={player.user.id} className={cn(
                          "text-center p-1 font-medium w-10 max-w-10",
                          player.user.id === whopUser?.id ? "text-blue-400" : "text-slate-300",
                          gameState.currentTurnUserId === player.user.id && "bg-green-500/10"
                        )}>
                          <div className="truncate text-xs" title={player.user.id === whopUser?.id ? "You" : player.user.username || "Player"}>
                            {player.user.id === whopUser?.id ? "You" : (player.user.username || "Player").slice(0, 8)}
                          </div>
                          {gameState.currentTurnUserId === player.user.id && (
                            <div className="text-xs text-green-400 leading-tight">Turn</div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Upper Section Categories */}
                    {upperSectionCategories.map((category) => {
                      return (
                        <tr key={category.key} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                          <td className="p-0.5 pl-3 text-slate-200 font-medium text-xs w-16 max-w-16">
                            <div className="truncate" title={category.label}>{category.label}</div>
                          </td>
                          {gameState.players.map((player) => {
                            const playerState = player.state;
                            const score = playerState ? (playerState as any)[category.key] ?? -1 : -1;
                            const isUsed = score !== -1;
                            const isMyTurn = gameState.currentTurnUserId === whopUser?.id;
                            const isMyCell = player.user.id === whopUser?.id;
                            const potentialScore = isMyTurn && isMyCell && currentTurn ? calculatePotentialScore(category.key) : 0;
                            const canSelect = isMyTurn && isMyCell && !isUsed && (currentTurn?.rollCount || 0) > 0;
                            
                            return (
                              <td key={player.user.id} className={cn(
                                "p-0.5 text-center border-l border-slate-700/30 w-10 max-w-10",
                                gameState.currentTurnUserId === player.user.id && "bg-green-500/5"
                              )}>
                                {canSelect ? (
                                  <button
                                    onClick={() => handleImmediateScore(category.key)}
                                    className="w-full h-6 rounded border transition-all text-xs bg-slate-800/80 border-slate-600 hover:bg-slate-700/80 hover:border-slate-500 text-slate-300"
                                    data-testid={`category-${category.key}-${player.user.id}`}
                                  >
                                    {potentialScore}
                                  </button>
                                ) : (
                                  <div className={cn(
                                    "h-6 flex items-center justify-center rounded text-xs",
                                    isUsed ? "text-green-400 font-bold" : "text-slate-500"
                                  )}>
                                    {isUsed ? score : "-"}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    
                    {/* Upper Section Totals */}
                    <tr className="border-b border-slate-600 bg-slate-800/30">
                      <td className="p-0.5 pl-3 text-slate-300 font-medium text-xs w-16 max-w-16">Subtotal</td>
                      {gameState.players.map((player) => {
                        const playerState = player.state;
                        const subtotal = upperSectionCategories.reduce((sum, cat) => {
                          const score = playerState ? (playerState as any)[cat.key] : -1;
                          return sum + (score > 0 ? score : 0);
                        }, 0);
                        return (
                          <td key={player.user.id} className="p-0.5 text-center text-slate-200 font-medium border-l border-slate-700/30 text-xs w-10 max-w-10">
                            {subtotal}
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="border-b border-slate-600 bg-slate-800/30">
                      <td className="p-0.5 pl-3 text-slate-300 font-medium text-xs w-16 max-w-16">Bonus</td>
                      {gameState.players.map((player) => {
                        const playerState = player.state;
                        const subtotal = upperSectionCategories.reduce((sum, cat) => {
                          const score = playerState ? (playerState as any)[cat.key] : -1;
                          return sum + (score > 0 ? score : 0);
                        }, 0);
                        const bonus = subtotal >= 63 ? 35 : 0;
                        return (
                          <td key={player.user.id} className={cn(
                            "p-0.5 text-center font-medium border-l border-slate-700/30 text-xs w-10 max-w-10",
                            bonus > 0 ? "text-yellow-400" : "text-slate-500"
                          )}>
                            {bonus > 0 ? bonus : "-"}
                          </td>
                        );
                      })}
                    </tr>
                    
                    {/* Lower Section Categories */}
                    {lowerSectionCategories.map((category) => {
                      return (
                        <tr key={category.key} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                          <td className="p-0.5 pl-3 text-slate-200 font-medium text-xs w-16 max-w-16">
                            <div className="truncate" title={category.label}>{category.label}</div>
                          </td>
                          {gameState.players.map((player) => {
                            const playerState = player.state;
                            const score = playerState ? (playerState as any)[category.key] ?? -1 : -1;
                            const isUsed = score !== -1;
                            const isMyTurn = gameState.currentTurnUserId === whopUser?.id;
                            const isMyCell = player.user.id === whopUser?.id;
                            const potentialScore = isMyTurn && isMyCell && currentTurn ? calculatePotentialScore(category.key) : 0;
                            const canSelect = isMyTurn && isMyCell && !isUsed && (currentTurn?.rollCount || 0) > 0;
                            
                            return (
                              <td key={player.user.id} className={cn(
                                "p-0.5 text-center border-l border-slate-700/30 w-10 max-w-10",
                                gameState.currentTurnUserId === player.user.id && "bg-green-500/5"
                              )}>
                                {canSelect ? (
                                  <button
                                    onClick={() => handleImmediateScore(category.key)}
                                    className="w-full h-6 rounded border transition-all text-xs bg-slate-800/80 border-slate-600 hover:bg-slate-700/80 hover:border-slate-500 text-slate-300"
                                    data-testid={`category-${category.key}-${player.user.id}`}
                                  >
                                    {potentialScore}
                                  </button>
                                ) : (
                                  <div className={cn(
                                    "h-6 flex items-center justify-center rounded text-xs",
                                    isUsed ? "text-green-400 font-bold" : "text-slate-500"
                                  )}>
                                    {isUsed ? score : "-"}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    
                    {/* Total Score Row */}
                    <tr className="border-t-2 border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
                      <td className="p-0.5 pl-3 text-yellow-400 font-bold text-xs w-16 max-w-16">TOTAL SCORE</td>
                      {gameState.players.map((player) => {
                        const playerState = player.state;
                        const upperTotal = upperSectionCategories.reduce((sum, cat) => {
                          const score = playerState ? (playerState as any)[cat.key] : -1;
                          return sum + (score > 0 ? score : 0);
                        }, 0);
                        const bonus = upperTotal >= 63 ? 35 : 0;
                        const lowerTotal = lowerSectionCategories.reduce((sum, cat) => {
                          const score = playerState ? (playerState as any)[cat.key] : -1;
                          return sum + (score > 0 ? score : 0);
                        }, 0);
                        const grandTotal = upperTotal + bonus + lowerTotal;
                        return (
                          <td key={player.user.id} className="p-1 text-center text-yellow-400 font-bold text-sm border-l border-slate-700/30">
                            {grandTotal}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Game Info Section - Moved to Bottom */}
      <Card className="bg-gradient-to-r from-blue-500/10 to-purple-600/10 border-blue-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Crown className="w-6 h-6 text-yellow-500" />
              <span className="text-lg font-medium">Yahtzee Game - Round {gameState.currentRound}/{gameState.game.totalRounds || 13}</span>
            </div>
            <div className="flex items-center space-x-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-slate-500 hover:text-slate-400 hover:bg-slate-800/50 text-xs"
                    data-testid="button-forfeit"
                  >
                    <LogOut className="w-3 h-3 mr-1" />
                    Forfeit
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-slate-900 border-red-800">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-400 flex items-center space-x-2">
                      <LogOut className="w-5 h-5" />
                      <span>Forfeit Match?</span>
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-300">
                      Are you sure you want to forfeit this match? 
                      <br /><br />
                      <span className="text-red-400 font-semibold">⚠️ Warning:</span>
                      <ul className="mt-2 space-y-1 text-sm">
                        <li>• You will automatically lose this match</li>
                        <li>• Your entry fee will NOT be refunded</li>
                        <li>• You cannot rejoin this match</li>
                      </ul>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600">
                      Stay in Match
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleForfeit}
                      disabled={leaveGame.isPending}
                      className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                      data-testid="confirm-forfeit"
                    >
                      {leaveGame.isPending ? "Forfeiting..." : "Yes, Forfeit Match"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                    data-testid="button-how-to-play"
                  >
                    <HelpCircle className="w-4 h-4 mr-2" />
                    How to Play
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-center mb-4 text-blue-400">
                      How to Play Yahtzee
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">🎯 Objective</h3>
                      <p>Get the highest total score by making the best dice combinations in 13 turns.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">🎲 How to Play</h3>
                      <p>Each player gets 13 turns. Each turn consists of up to 3 rolls of 5 dice. After your final roll, pick a scoring category.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">📊 Scoring</h3>
                      <p>Upper Section: Count specific numbers. Lower Section: Special combinations. Each category can only be used once.</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Badge variant="secondary" className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>{gameState.players.length} Players</span>
              </Badge>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-blue-400 font-medium">
                Current Turn: {currentPlayer?.user.username || 'Unknown'}
              </span>
            </div>
            {isMyTurn && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                Your Turn!
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}