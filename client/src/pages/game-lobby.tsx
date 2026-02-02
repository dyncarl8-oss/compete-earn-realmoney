import { useWhopUser } from "@/hooks/use-whop-user";
import { useUserActiveGame, useUser } from "@/hooks/use-user";
import { useGameParticipants, useLeaveGame } from "@/hooks/use-games";
import { useWhopPayments } from "@/hooks/use-whop-payments";
import { useWithdrawals } from "@/hooks/use-withdrawals";
import { useActiveTournaments, useUserActiveTournaments } from "@/hooks/use-tournaments";
import { useAccessCheck } from "@/hooks/use-access-check";
import { Button } from "@/components/ui/button";
import { WithdrawalDialog } from "@/components/withdrawal-dialog";
import InvitePlayersModal from "@/components/invite-players-modal";
import { Plus, Download, Timer, Trophy, Wallet, Gamepad2, Loader2, History, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useBalanceUpdates, authenticateWebSocket } from "@/hooks/use-websocket";


export default function GameLobby() {
  const { user: whopUser, isLoading: whopLoading, error: whopError } = useWhopUser();
  const { data: user, isLoading: userLoading } = useUser();
  const { data: activeGame } = useUserActiveGame();
  const { data: participants } = useGameParticipants(activeGame?.id || "");
  const leaveGame = useLeaveGame();
  const { makePayment, isPaymentPending, isRealPaymentsAvailable } = useWhopPayments();
  const { availableForWithdrawal } = useWithdrawals();
  const { toast } = useToast();
  const [gameTimer, setGameTimer] = useState(154); // 2:34 in seconds
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [location, setLocation] = useLocation();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [joiningTournamentId, setJoiningTournamentId] = useState<string | null>(null);

  const [resourceIds] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    
    let companyId = params.get('companyId') || undefined;
    let experienceId = params.get('experienceId') || undefined;
    
    if (!companyId && !experienceId) {
      if (pathParts[0] === 'dashboard' && pathParts[1]?.startsWith('biz_')) {
        companyId = pathParts[1];
      } else if (pathParts[0] === 'experiences' && pathParts[1]?.startsWith('exp_')) {
        experienceId = pathParts[1];
      }
    }
    
    return { companyId, experienceId };
  });

  const { isAdmin } = useAccessCheck({
    companyId: resourceIds.companyId,
    experienceId: resourceIds.experienceId,
  });

  const { data: activeTournaments } = useActiveTournaments();
  const { data: userActiveTournaments } = useUserActiveTournaments(whopUser?.id);
  
  const shouldShowMultiplayerGames = isAdmin;

  // Listen for real-time balance updates via WebSocket
  useBalanceUpdates(whopUser?.id);

  // Authenticate WebSocket when user is available
  useEffect(() => {
    if (whopUser?.id && whopUser?.username) {
      authenticateWebSocket(whopUser.id, whopUser.username);
    }
  }, [whopUser?.id, whopUser?.username]);

  // Track page view
  useEffect(() => {
    const trackPageView = async () => {
      try {
        await fetch('/api/analytics/page-view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pagePath: '/',
          }),
        });
      } catch (error) {
        // Silently fail - don't interrupt user experience
        console.debug('Page view tracking failed:', error);
      }
    };
    
    trackPageView();
  }, []);

  // Auto-navigate to game room when user has an active running game
  useEffect(() => {
    if (activeGame?.status === "running") {
      if (activeGame.gameType === "chess") {
        setLocation(`/chess/${activeGame.id}`);
      } else if (activeGame.gameType === "yahtzee") {
        setLocation(`/game/${activeGame.id}`);
      }
    }
  }, [activeGame, setLocation]);

  // Auto-redirect to tournament waiting room if user is in an active tournament
  useEffect(() => {
    if (userActiveTournaments && userActiveTournaments.length > 0 && !activeGame) {
      const activeTournament = userActiveTournaments[0];
      // Only redirect if the tournament is still active or started (not completed/cancelled)
      if (activeTournament.status === 'active' || activeTournament.status === 'started') {
        console.log(`Auto-redirecting to tournament waiting room: ${activeTournament.id}`);
        setLocation(`/tournament/${activeTournament.id}/waiting`);
      }
    }
  }, [userActiveTournaments, activeGame, setLocation]);

  // Create fallback user for development when authentication fails
  const fallbackUser = {
    id: "demo-user-123",
    username: "DemoPlayer",
    email: "demo@example.com",
    balance: "100.00",
    totalWinnings: "25.50",
    gamesPlayed: 8,
    gamesWon: 3,
    profileImageUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=80&h=80"
  };

  // Wait for real user data to load first, only use fallback if auth actually failed
  const hasRealUserData = user || whopUser;
  const isStillLoading = whopLoading || userLoading;
  const authFailed = !isStillLoading && !hasRealUserData && whopError;

  // Use actual user data if available, otherwise use fallback only after auth fails
  const currentUser = hasRealUserData || (authFailed ? fallbackUser : null);

  // Loading states - show loading until we have real user data or confirmed auth failure
  const isLoading = isStillLoading || (!hasRealUserData && !authFailed);
  const hasError = false; // Always use fallback in development, so no errors


  useEffect(() => {
    if (activeGame?.status === "running") {
      const timer = setInterval(() => {
        setGameTimer((prev) => {
          if (prev <= 0) {
            return 154; // Reset timer
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [activeGame?.status]);

  const handleLeaveGame = async () => {
    if (!activeGame) return;

    try {
      await leaveGame.mutateAsync({ gameId: activeGame.id });
      toast({
        title: "Left game successfully",
        description: "You've been refunded the entry fee.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to leave game. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show loading screen if waiting for data
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg animate-pulse">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Loading Compete & Earn Real Money...</h2>
          <p className="text-slate-400">Validating user credentials</p>
        </div>
      </div>
    );
  }

  // Show error screen if unable to load user data
  if (hasError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connection Error</h2>
          <p className="text-slate-400">Unable to load user data</p>
        </div>
      </div>
    );
  }

  // Ensure we have user data before rendering the main component
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg animate-pulse">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Loading Compete & Earn Real Money...</h2>
          <p className="text-slate-400">Initializing user session</p>
        </div>
      </div>
    );
  }

  const handleAddFunds = async (amount: number) => {
    try {
      setPendingAmount(amount);
      await makePayment({
        amount,
        description: "Compete & Earn Real Money",
        metadata: { type: "game_credits" },
      });
      setShowAddFunds(false);
      toast({
        title: "Funds added successfully!",
        description: `$${amount} has been added to your account.`,
      });
    } catch (error) {
      // Error is already handled by useWhopPayments hook
    } finally {
      setPendingAmount(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* User Profile Card */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-700 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="relative flex-shrink-0">
                  <img 
                    src={currentUser.profileImageUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=80&h=80"} 
                    alt="Profile" 
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-4 border-violet-500 shadow-lg"
                    data-testid="profile-avatar"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-emerald-500 border-3 border-slate-800 rounded-full"></div>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl font-bold text-white truncate" data-testid="profile-username">
                    {currentUser.username}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 truncate">User ID: {currentUser.id}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-2 rounded-xl border border-slate-600 text-center sm:text-left">
                  <span className="text-slate-300 text-xs sm:text-sm font-medium">Balance: </span>
                  <span className="text-white text-base sm:text-lg font-bold" data-testid="profile-balance">
                    ${parseFloat(currentUser.balance).toFixed(2)}
                  </span>
                </div>

                {showAddFunds ? (
                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
                      <button 
                        onClick={() => handleAddFunds(5)}
                        disabled={(pendingAmount === 5) || !isRealPaymentsAvailable}
                        className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-1 text-sm" 
                        data-testid="button-add-5"
                      >
                        {pendingAmount === 5 ? <Loader2 className="w-4 h-4 animate-spin" /> : "$5"}
                      </button>
                      <button 
                        onClick={() => handleAddFunds(10)}
                        disabled={(pendingAmount === 10) || !isRealPaymentsAvailable}
                        className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-1 text-sm" 
                        data-testid="button-add-10"
                      >
                        {pendingAmount === 10 ? <Loader2 className="w-4 h-4 animate-spin" /> : "$10"}
                      </button>
                      <button 
                        onClick={() => handleAddFunds(25)}
                        disabled={(pendingAmount === 25) || !isRealPaymentsAvailable}
                        className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-1 text-sm" 
                        data-testid="button-add-25"
                      >
                        {pendingAmount === 25 ? <Loader2 className="w-4 h-4 animate-spin" /> : "$25"}
                      </button>
                      <button 
                        onClick={() => handleAddFunds(50)}
                        disabled={(pendingAmount === 50) || !isRealPaymentsAvailable}
                        className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-1 text-sm" 
                        data-testid="button-add-50"
                      >
                        {pendingAmount === 50 ? <Loader2 className="w-4 h-4 animate-spin" /> : "$50"}
                      </button>
                    </div>
                    <button 
                      onClick={() => setShowAddFunds(false)}
                      className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white px-4 py-2 rounded-lg font-semibold shadow-lg transition-all duration-200 hover:scale-105 text-sm"
                      data-testid="button-cancel-add-funds"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-3">
                    <button 
                      onClick={() => setShowAddFunds(true)}
                      className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 hover:scale-105 text-sm sm:text-base" 
                      data-testid="button-add-funds"
                    >
                      <Plus className="w-4 h-4 mr-2 inline" />
                      Add Funds
                    </button>

                    <WithdrawalDialog>
                      <button 
                        className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2 text-sm sm:text-base"
                        data-testid="button-withdraw"
                      >
                        <Download className="w-4 h-4" />
                        <span>Withdraw</span>
                      </button>
                    </WithdrawalDialog>
                  </div>
                )}

                {!isRealPaymentsAvailable && showAddFunds && (
                  <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg px-3 py-2">
                    <span className="text-blue-300 text-xs">🔄 Connecting to payment system...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="mb-6 sm:mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/30 rounded-xl p-3 sm:p-6 text-center">
              <p className="text-xl sm:text-3xl font-bold text-emerald-400" data-testid="stat-total-winnings">
                ${parseFloat(currentUser.totalWinnings).toFixed(2)}
              </p>
              <p className="text-xs sm:text-sm text-emerald-300 font-medium mt-1">Total Winnings</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-blue-500/30 rounded-xl p-3 sm:p-6 text-center">
              <p className="text-xl sm:text-3xl font-bold text-blue-400" data-testid="stat-games-played">
                {currentUser.gamesPlayed}
              </p>
              <p className="text-xs sm:text-sm text-blue-300 font-medium mt-1">Games Played</p>
            </div>
            <div className="bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 rounded-xl p-3 sm:p-6 text-center">
              <p className="text-xl sm:text-3xl font-bold text-violet-400" data-testid="stat-games-won">
                {currentUser.gamesWon}
              </p>
              <p className="text-xs sm:text-sm text-violet-300 font-medium mt-1">Games Won</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500/20 to-red-600/20 border border-orange-500/30 rounded-xl p-3 sm:p-6 text-center">
              <p className="text-xl sm:text-3xl font-bold text-orange-400" data-testid="stat-win-rate">
                {currentUser.gamesPlayed > 0 ? ((currentUser.gamesWon / currentUser.gamesPlayed) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-xs sm:text-sm text-orange-300 font-medium mt-1">Win Rate</p>
            </div>
          </div>
        </div>


        {/* Active Game Section */}
        <div className="mb-6 sm:mb-8">
            {activeGame ? (
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-8 shadow-2xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="p-3 sm:p-4 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl shadow-lg flex-shrink-0">
                      <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-2xl font-bold text-white truncate" data-testid="active-game-name">
                        {activeGame.name}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-400 font-medium">Active Competition</p>
                    </div>
                  </div>
                  <div className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm font-bold shadow-lg whitespace-nowrap ${
                    activeGame.status === "running" 
                      ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white animate-pulse" 
                      : "bg-gradient-to-r from-yellow-500 to-orange-600 text-white"
                  }`} data-testid="active-game-status">
                    {activeGame.status === "running" ? "🔴 LIVE NOW" : "⏳ Starting Soon"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-6 sm:mb-8">
                  <div className="text-center p-3 sm:p-6 bg-gradient-to-br from-red-500/20 to-pink-600/20 border border-red-500/30 rounded-xl">
                    <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-red-400 mx-auto mb-2 sm:mb-3" />
                    <p className="text-xs sm:text-sm text-red-300 font-medium mb-1">Entry Fee</p>
                    <p className="text-xl sm:text-3xl font-bold text-red-400" data-testid="active-game-entry-fee">
                      ${parseFloat(activeGame.entryFee).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center p-3 sm:p-6 bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/30 rounded-xl">
                    <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400 mx-auto mb-2 sm:mb-3" />
                    <p className="text-xs sm:text-sm text-emerald-300 font-medium mb-1">Prize Pool</p>
                    <p className="text-xl sm:text-3xl font-bold text-emerald-400" data-testid="active-game-prize">
                      ${parseFloat(activeGame.prizeAmount).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="mb-6 sm:mb-8">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                    <h3 className="text-lg sm:text-xl font-bold text-white">Battle Arena</h3>
                    <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full" data-testid="active-game-player-count">
                      <span className="text-white font-bold text-xs sm:text-sm">{activeGame.currentPlayers}/{activeGame.maxPlayers} Players</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                    {participants?.map((participant, index) => (
                      <div key={participant.id} className={`p-3 sm:p-4 rounded-xl text-center transition-all hover:scale-105 ${
                        participant.userId === currentUser?.id 
                          ? 'bg-gradient-to-br from-violet-500/30 to-purple-600/30 border-2 border-violet-400 shadow-lg' 
                          : 'bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600'
                      }`}>
                        <img 
                          src={participant.user?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=60&h=60"} 
                          alt={`Player ${index + 1}`} 
                          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover mx-auto mb-2 sm:mb-3 ${
                            participant.userId === currentUser?.id ? 'ring-3 ring-violet-400' : 'ring-2 ring-slate-500'
                          }`}
                          data-testid={`participant-avatar-${index}`}
                        />
                        <p className={`text-xs sm:text-sm font-medium truncate ${
                          participant.userId === currentUser?.id ? 'text-violet-300' : 'text-slate-300'
                        }`} data-testid={`participant-name-${index}`}>
                          {participant.user?.username || "Unknown"}
                        </p>
                        {participant.userId === user?.id && (
                          <p className="text-xs text-violet-400 font-bold mt-1">YOU</p>
                        )}
                      </div>
                    ))}

                    {Array.from({ length: activeGame.maxPlayers - activeGame.currentPlayers }).map((_, index) => (
                      <div key={`empty-${index}`} className="p-3 sm:p-4 rounded-xl border-2 border-dashed border-slate-600 text-center bg-slate-800/50 relative group">
                        {/* Chat Bubble - "Invite Players" */}
                        <div className="hidden sm:flex absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap shadow-lg items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <MessageSquare className="w-3 h-3" />
                          <span>Invite Players</span>
                          {/* Speech bubble arrow */}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-purple-600"></div>
                        </div>

                        {/* Clickable Plus Icon */}
                        <button
                          onClick={() => setIsInviteModalOpen(true)}
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-700 mx-auto mb-2 sm:mb-3 flex items-center justify-center border-2 border-dashed border-slate-600 hover:border-violet-400 hover:bg-gradient-to-br hover:from-violet-500/20 hover:to-purple-600/20 transition-all duration-200 hover:scale-110"
                        >
                          <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 group-hover:text-violet-400 transition-colors" />
                        </button>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">Open Slot</p>
                      </div>
                    ))}
                  </div>
                </div>

                {activeGame.status === "running" ? (
                  <div className="bg-gradient-to-r from-emerald-500/20 to-green-600/20 border border-emerald-500/30 rounded-xl p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center space-x-3 sm:space-x-4">
                        <div className="p-2.5 sm:p-3 bg-emerald-500/20 rounded-xl flex-shrink-0">
                          <Timer className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-lg sm:text-xl font-bold text-emerald-400">Battle in Progress</p>
                          <p className="text-emerald-300 text-xs sm:text-sm">Competition is live!</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl sm:text-4xl font-bold text-emerald-400" data-testid="game-timer">
                          {formatTime(gameTimer)}
                        </p>
                        <p className="text-emerald-300 text-xs sm:text-sm">Time remaining</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="bg-gradient-to-r from-yellow-500/20 to-orange-600/20 border border-yellow-500/30 rounded-xl p-4 sm:p-6 text-center">
                      <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse mx-auto mb-3"></div>
                      <p className="text-sm sm:text-base text-yellow-300 font-medium">Waiting for more players to join...</p>
                      <p className="text-yellow-400 text-xs sm:text-sm mt-1">Game starts when lobby is full</p>
                    </div>

                    <button 
                      className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg text-sm sm:text-base"
                      onClick={handleLeaveGame}
                      disabled={leaveGame.isPending}
                      data-testid="button-leave-game"
                    >
                      {leaveGame.isPending ? "Leaving Game..." : "🚪 Leave Game"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Tournaments Section - Highlighted at the top */}
                <div className="mb-6 sm:mb-8">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                      <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-500" />
                      <span className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-transparent bg-clip-text">🏆 Active Tournaments</span>
                    </h2>
                    <Button
                      onClick={() => setLocation("/match-history")}
                      variant="outline"
                      className="border-violet-500/50 text-violet-400 hover:bg-violet-500/20 hover:text-violet-300 shadow-lg transition-all duration-200"
                      size="sm"
                    >
                      <History className="w-4 h-4 mr-2" />
                      Match History
                    </Button>
                  </div>
                  
                  {activeTournaments && activeTournaments.length > 0 ? (
                    <div className="grid gap-4">
                      {activeTournaments.map((tournament) => (
                        <div 
                          key={tournament.id}
                          className="relative bg-gradient-to-br from-yellow-500/10 via-orange-500/10 to-red-500/10 border-2 border-yellow-500/50 rounded-2xl p-4 sm:p-6 shadow-2xl hover:shadow-yellow-500/20 transition-all duration-300 hover:scale-[1.02]"
                        >
                          {/* Tournament Badge */}
                          <div className="absolute top-3 right-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg animate-pulse">
                            🔥 LIVE
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                            <div>
                              <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                                {tournament.name}
                              </h3>
                              <p className="text-sm text-gray-300">
                                {tournament.gameType.charAt(0).toUpperCase() + tournament.gameType.slice(1)} Tournament
                                {tournament.description && ` • ${tournament.description}`}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <div className="bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/30 rounded-xl p-3 text-center">
                              <p className="text-xs text-emerald-300 mb-1">Prize Pool</p>
                              <p className="text-lg sm:text-xl font-bold text-emerald-400">
                                ${parseFloat(tournament.potAmount).toFixed(2)}
                              </p>
                            </div>
                            
                            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-blue-500/30 rounded-xl p-3 text-center">
                              <p className="text-xs text-blue-300 mb-1">Entry Fee</p>
                              <p className="text-lg sm:text-xl font-bold text-blue-400">
                                ${parseFloat(tournament.entryFee).toFixed(2)}
                              </p>
                            </div>

                            <div className="bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 rounded-xl p-3 text-center">
                              <p className="text-xs text-violet-300 mb-1">Players</p>
                              <p className="text-lg sm:text-xl font-bold text-violet-400">
                                {tournament.currentParticipants}/{tournament.maxParticipants}
                              </p>
                            </div>

                            <div className="bg-gradient-to-br from-orange-500/20 to-red-600/20 border border-orange-500/30 rounded-xl p-3 text-center">
                              <p className="text-xs text-orange-300 mb-1">Slots Left</p>
                              <p className="text-lg sm:text-xl font-bold text-orange-400">
                                {tournament.maxParticipants - tournament.currentParticipants}
                              </p>
                            </div>
                          </div>

                          <button 
                            onClick={async () => {
                              if (isAdmin) {
                                if (tournament.gameType === 'yahtzee') {
                                  setLocation('/yahtzee');
                                } else if (tournament.gameType === 'chess') {
                                  setLocation('/chess');
                                }
                              } else if (tournament.isParticipant) {
                                // User already joined, take them to waiting room
                                setLocation(`/tournament/${tournament.id}/waiting`);
                              } else {
                                // User hasn't joined yet, join the tournament
                                setJoiningTournamentId(tournament.id);
                                try {
                                  const response = await fetch(`/api/tournaments/${tournament.id}/join`, {
                                    method: "POST",
                                    credentials: "include",
                                  });

                                  if (!response.ok) {
                                    if (response.status === 409) {
                                      toast({
                                        title: "Already Joined",
                                        description: "Taking you to the waiting room...",
                                      });
                                      setLocation(`/tournament/${tournament.id}/waiting`);
                                      return;
                                    }
                                    
                                    const error = await response.json();
                                    toast({
                                      title: "Error",
                                      description: error.message || "Failed to join tournament",
                                      variant: "destructive",
                                    });
                                    return;
                                  }

                                  toast({
                                    title: "Joined Tournament",
                                    description: `You've joined ${tournament.name}!`,
                                  });
                                  setLocation(`/tournament/${tournament.id}/waiting`);
                                } catch (error) {
                                  toast({
                                    title: "Error",
                                    description: "Failed to join tournament. Please try again.",
                                    variant: "destructive",
                                  });
                                } finally {
                                  setJoiningTournamentId(null);
                                }
                              }
                            }}
                            disabled={joiningTournamentId === tournament.id}
                            className={`w-full ${
                              tournament.isParticipant 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' 
                                : 'bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600'
                            } disabled:from-gray-500 disabled:to-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 sm:py-4 px-6 rounded-xl shadow-xl transition-all duration-200 hover:scale-105 disabled:hover:scale-100 text-sm sm:text-base flex items-center justify-center gap-2`}
                          >
                            {joiningTournamentId === tournament.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Joining...
                              </>
                            ) : (
                              <>
                                {isAdmin ? "🎮 Manage Tournament" : tournament.isParticipant ? "✅ Go to Waiting Room" : "🎮 Join Tournament Now"}
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-dashed border-slate-600 rounded-2xl p-8 sm:p-12 text-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 rounded-2xl"></div>
                      <div className="relative z-10">
                        <Trophy className="w-16 h-16 sm:w-20 sm:h-20 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-xl sm:text-2xl font-bold text-slate-400 mb-2">
                          No Tournaments Yet
                        </h3>
                        <p className="text-slate-500 text-sm sm:text-base">
                          Your admin hasn't hosted any tournaments yet. Check back soon for exciting competitions or try out instant games below!
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Instant Games Section */}
                <div className="mb-6 sm:mb-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4 flex items-center justify-between gap-2">
                    <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-transparent bg-clip-text">⚡ Instant Games</span>
                    <span className="text-xs bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded-full whitespace-nowrap">Play Now!</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                    {/* Plinko Card */}
                    <button 
                      onClick={() => setLocation("/plinko")}
                      className="group relative bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 sm:p-6 shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden border-2 border-yellow-400/50"
                    >
                      <div className="absolute top-2 right-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs px-2 sm:px-3 py-1 rounded-full font-bold shadow-lg">
                        NEW
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="relative z-10">
                        <div className="text-5xl sm:text-6xl mb-2 sm:mb-3">🎯</div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Plinko</h3>
                        <p className="text-yellow-100 text-xs sm:text-sm mb-3 sm:mb-4">Drop the ball & win instantly!</p>
                        <div className="flex justify-between items-center">
                          <div className="text-xs bg-white/20 px-2 sm:px-3 py-1 rounded-full text-white font-semibold">
                            Play Solo
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-white">
                            Up to 3x!
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Dice Card */}
                    <button 
                      onClick={() => setLocation("/dice")}
                      className="group relative bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-4 sm:p-6 shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden border-2 border-blue-400/50"
                    >
                      <div className="absolute top-2 right-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs px-2 sm:px-3 py-1 rounded-full font-bold shadow-lg">
                        NEW
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="relative z-10">
                        <div className="text-5xl sm:text-6xl mb-2 sm:mb-3">🎲</div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Dice Roll</h3>
                        <p className="text-blue-100 text-xs sm:text-sm mb-3 sm:mb-4">Over or under? You decide!</p>
                        <div className="flex justify-between items-center">
                          <div className="text-xs bg-white/20 px-2 sm:px-3 py-1 rounded-full text-white font-semibold">
                            Play Solo
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-white">
                            Up to 96x!
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Slots Card */}
                    <button 
                      onClick={() => setLocation("/slots")}
                      className="group relative bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl p-4 sm:p-6 shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden border-2 border-yellow-400/50"
                    >
                      <div className="absolute top-2 right-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs px-2 sm:px-3 py-1 rounded-full font-bold shadow-lg">
                        NEW
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="relative z-10">
                        <div className="text-5xl sm:text-6xl mb-2 sm:mb-3">🎰</div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Slots</h3>
                        <p className="text-yellow-100 text-xs sm:text-sm mb-3 sm:mb-4">Spin to win big prizes!</p>
                        <div className="flex justify-between items-center">
                          <div className="text-xs bg-white/20 px-2 sm:px-3 py-1 rounded-full text-white font-semibold">
                            Play Solo
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-white">
                            Up to 50x!
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Multiplayer Games Section - Only show if admin or there's an active tournament */}
                {shouldShowMultiplayerGames && (
                <div className="mb-6 sm:mb-8">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 sm:mb-4">
                    <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                      <span className="bg-gradient-to-r from-violet-400 to-purple-500 text-transparent bg-clip-text">👥 Multiplayer Games</span>
                      <span className="text-xs bg-gradient-to-r from-violet-500 to-purple-600 text-white px-3 py-1 rounded-full whitespace-nowrap">Compete to Win!</span>
                    </h2>
                    <button
                      onClick={() => setLocation('/match-history')}
                      className="bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-300 hover:text-violet-200 text-xs sm:text-sm py-1.5 px-3 rounded-lg transition-all duration-200 flex items-center gap-1.5"
                      data-testid="button-match-history"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Match History</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    {/* Yahtzee Card */}
                    <button 
                      onClick={() => setLocation("/yahtzee")}
                      className="group relative bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-4 sm:p-6 shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden border-2 border-emerald-400/50"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="relative z-10">
                        <div className="text-5xl sm:text-6xl mb-2 sm:mb-3">🎲</div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Yahtzee</h3>
                        <p className="text-green-100 text-xs sm:text-sm mb-3 sm:mb-4">Roll dice & score strategically!</p>
                        <div className="flex justify-between items-center">
                          <div className="text-xs bg-white/20 px-2 sm:px-3 py-1 rounded-full text-white font-semibold">
                            2-5 Players
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-white">
                            Winner takes all!
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Chess Card */}
                    <button 
                      onClick={() => setLocation("/chess")}
                      className="group relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 sm:p-6 shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden border-2 border-blue-400/50"
                    >
                      <div className="absolute top-2 right-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs px-2 sm:px-3 py-1 rounded-full font-bold shadow-lg">
                        NEW
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="relative z-10">
                        <div className="text-5xl sm:text-6xl mb-2 sm:mb-3">♟️</div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Chess</h3>
                        <p className="text-blue-100 text-xs sm:text-sm mb-3 sm:mb-4">Outsmart your opponent!</p>
                        <div className="flex justify-between items-center">
                          <div className="text-xs bg-white/20 px-2 sm:px-3 py-1 rounded-full text-white font-semibold">
                            2 Players
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-white">
                            Winner takes all!
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Poker - Coming Soon */}
                    <div className="relative bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl opacity-60 border-2 border-slate-600">
                      <div className="absolute top-2 right-2 bg-violet-500 text-white text-xs px-2 sm:px-3 py-1 rounded-full font-bold">
                        Coming Soon
                      </div>
                      <div className="text-5xl sm:text-6xl mb-2 sm:mb-3 opacity-50">🃏</div>
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-300 mb-1 sm:mb-2">Poker</h3>
                      <p className="text-slate-400 text-xs sm:text-sm mb-3 sm:mb-4">Texas Hold'em tournaments!</p>
                      <div className="flex justify-between items-center">
                        <div className="text-xs bg-slate-600 px-2 sm:px-3 py-1 rounded-full text-slate-300 font-semibold">
                          2-8 Players
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-slate-300">
                          Big prizes!
                        </div>
                      </div>
                    </div>

                    {/* Tic-Tac-Toe - Coming Soon */}
                    <div className="relative bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl opacity-60 border-2 border-slate-600">
                      <div className="absolute top-2 right-2 bg-violet-500 text-white text-xs px-2 sm:px-3 py-1 rounded-full font-bold">
                        Coming Soon
                      </div>
                      <div className="text-5xl sm:text-6xl mb-2 sm:mb-3 opacity-50">⭕</div>
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-300 mb-1 sm:mb-2">Tic-Tac-Toe</h3>
                      <p className="text-slate-400 text-xs sm:text-sm mb-3 sm:mb-4">Fast-paced strategy game!</p>
                      <div className="flex justify-between items-center">
                        <div className="text-xs bg-slate-600 px-2 sm:px-3 py-1 rounded-full text-slate-300 font-semibold">
                          2 Players
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-slate-300">
                          Quick wins!
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}
          </div>

      </div>

      {/* Invite Players Modal */}
      {activeGame && (
        <InvitePlayersModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          gameId={activeGame.id}
          gameName={activeGame.name}
          shareUrl={`https://whop.com/joined/compete-and-earn/compete-and-earn-dice-royale-${activeGame.id}/app/`}
        />
      )}
    </div>
  );
}