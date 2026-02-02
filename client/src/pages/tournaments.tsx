import { useState } from "react";
import { useWhopUser } from "@/hooks/use-whop-user";
import { useUser } from "@/hooks/use-user";
import { useAccessCheck } from "@/hooks/use-access-check";
import { useTournaments, useCreateTournament, useUpdateTournamentStatus, useStartTournament, useNotifyTournamentMembers } from "@/hooks/use-tournaments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { WithdrawalDialog } from "@/components/withdrawal-dialog";
import { Trophy, Plus, Loader2, AlertCircle, Calendar, Users, DollarSign, Shield, Bell, CheckCircle, Banknote, HelpCircle, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { useWithdrawals } from "@/hooks/use-withdrawals";

export default function TournamentDashboard() {
  const [, setLocation] = useLocation();
  const { user: whopUser, isLoading: whopUserLoading } = useWhopUser();
  const { data: user, isLoading: userLoading } = useUser();
  const { availableForWithdrawal, isLoadingTransactions } = useWithdrawals();
  const [resourceIds] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    
    let companyId = params.get('companyId') || undefined;
    let experienceId = params.get('experienceId') || undefined;
    
    if (!companyId && !experienceId) {
      if (pathParts[0] === 'tournaments' && pathParts[1]?.startsWith('biz_')) {
        companyId = pathParts[1];
      } else if (pathParts[0] === 'tournaments' && pathParts[1]?.startsWith('exp_')) {
        experienceId = pathParts[1];
      }
    }
    
    return { companyId, experienceId };
  });

  const { isAdmin, isLoading: accessLoading } = useAccessCheck({
    companyId: resourceIds.companyId,
    experienceId: resourceIds.experienceId,
  });

  const { data: tournaments, isLoading: tournamentsLoading } = useTournaments();
  const createTournament = useCreateTournament();
  const updateStatus = useUpdateTournamentStatus();
  const startTournament = useStartTournament();
  const notifyMembers = useNotifyTournamentMembers();

  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [createdTournament, setCreatedTournament] = useState<any>(null);
  const [cancellingTournamentId, setCancellingTournamentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    gameType: "yahtzee",
    name: "",
    entryFee: "",
    maxParticipants: "5",
  });

  const ADMIN_COMMISSION_RATE = 0.10; // 10% admin commission
  const PRIZE_POOL_RATE = 0.75; // 75% goes to winner
  
  const calculatePrizePool = () => {
    const entryFee = parseFloat(formData.entryFee) || 0;
    const maxParticipants = parseInt(formData.maxParticipants) || 0;
    const totalEntryFees = entryFee * maxParticipants;
    return (totalEntryFees * PRIZE_POOL_RATE).toFixed(2);
  };

  const calculateAdminCommission = () => {
    const entryFee = parseFloat(formData.entryFee) || 0;
    const maxParticipants = parseInt(formData.maxParticipants) || 0;
    const totalEntryFees = entryFee * maxParticipants;
    return (totalEntryFees * ADMIN_COMMISSION_RATE).toFixed(2);
  };

  if (accessLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <Card className="bg-gray-800 border-gray-700 max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
              <p className="text-gray-400 mb-4">You must be an admin to access this page.</p>
              <Button onClick={() => setLocation("/")} className="bg-blue-600 hover:bg-blue-700">
                Return to Lobby
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreateTournament = async () => {
    try {
      const tournament = await createTournament.mutateAsync({
        gameType: formData.gameType,
        name: formData.name,
        potAmount: calculatePrizePool(),
        entryFee: parseFloat(formData.entryFee).toFixed(2),
        maxParticipants: parseInt(formData.maxParticipants),
        companyId: resourceIds.companyId,
        experienceId: resourceIds.experienceId,
      });
      
      setCreatedTournament(tournament);
      setIsCreateDialogOpen(false);
      setIsSuccessDialogOpen(true);
      setFormData({
        gameType: "yahtzee",
        name: "",
        entryFee: "",
        maxParticipants: "5",
      });
    } catch (error) {
      console.error("Failed to create tournament:", error);
    }
  };

  const handleNotifyMembers = async () => {
    if (createdTournament?.id) {
      try {
        await notifyMembers.mutateAsync(createdTournament.id);
        setCreatedTournament({
          ...createdTournament,
          notificationSent: true,
          notificationSentAt: new Date()
        });
      } catch (error) {
        console.error("Failed to notify members:", error);
      }
    }
  };

  const handleUpdateStatus = async (tournamentId: string, status: string) => {
    try {
      setCancellingTournamentId(tournamentId);
      await updateStatus.mutateAsync({ 
        tournamentId, 
        status,
        companyId: resourceIds.companyId,
        experienceId: resourceIds.experienceId
      });
    } catch (error) {
      console.error("Failed to update tournament status:", error);
    } finally {
      setCancellingTournamentId(null);
    }
  };

  const handleStartTournament = async (tournamentId: string) => {
    try {
      await startTournament.mutateAsync({
        tournamentId,
        companyId: resourceIds.companyId,
        experienceId: resourceIds.experienceId
      });
    } catch (error) {
      console.error("Failed to start tournament:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "started":
        return "bg-amber-500";
      case "completed":
        return "bg-blue-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const filteredTournaments = tournaments?.filter(t => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return t.status === "active" || t.status === "started";
    return t.status === statusFilter;
  }) || [];

  const statusCounts = {
    all: tournaments?.length ?? 0,
    active: tournaments?.filter(t => t.status === "active" || t.status === "started")?.length ?? 0,
    completed: tournaments?.filter(t => t.status === "completed")?.length ?? 0,
    cancelled: tournaments?.filter(t => t.status === "cancelled")?.length ?? 0,
  };

  const isHeaderLoading = whopUserLoading || userLoading;

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* Admin Header */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-700 shadow-xl">
            {isHeaderLoading ? (
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <Skeleton className="w-14 h-14 sm:w-16 sm:h-16 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-28" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="relative flex-shrink-0">
                    {whopUser?.profileImageUrl ? (
                      <img 
                        src={whopUser.profileImageUrl} 
                        alt="Admin Profile" 
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-4 border-violet-500 shadow-lg"
                      />
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 border-4 border-violet-500 shadow-lg flex items-center justify-center">
                        <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-emerald-500 border-3 border-slate-800 rounded-full"></div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg sm:text-xl font-bold text-white truncate">
                        {whopUser?.username || "Admin"}
                      </h2>
                      <span className="bg-gradient-to-r from-violet-500 to-purple-600 px-2 py-0.5 rounded-md text-xs font-semibold text-white flex items-center gap-1 shadow-lg">
                        <Shield className="w-3 h-3" />
                        ADMIN
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 truncate">
                      {whopUser?.id ? `User ID: ${whopUser.id}` : 'Administrator'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-2 rounded-xl border border-slate-600 text-center sm:text-left">
                    <span className="text-slate-300 text-xs sm:text-sm font-medium">Balance: </span>
                    <span className="text-white text-base sm:text-lg font-bold">
                      ${user ? parseFloat(user.balance).toFixed(2) : "0.00"}
                    </span>
                  </div>

                  <WithdrawalDialog>
                    <Button 
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 hover:scale-105 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!user || isLoadingTransactions || availableForWithdrawal < 20}
                    >
                      <Banknote className="w-4 h-4 mr-2" />
                      Withdraw
                    </Button>
                  </WithdrawalDialog>
                </div>
              </div>
            )}
          </div>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
              <DialogHeader className="pb-3">
                <DialogTitle className="text-xl font-bold">Create New Tournament</DialogTitle>
                <DialogDescription className="text-slate-400 text-sm">
                  Set up a new tournament for your members to compete
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="gameType" className="text-sm font-medium">Game Type</Label>
                    <Select value={formData.gameType} onValueChange={(value) => setFormData({ 
                      ...formData, 
                      gameType: value,
                      maxParticipants: value === "chess" ? "2" : "5"
                    })}>
                      <SelectTrigger className="bg-slate-700 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="yahtzee">Yahtzee</SelectItem>
                        <SelectItem value="chess">Chess</SelectItem>
                        <SelectItem value="poker" disabled>
                          <span className="flex items-center justify-between w-full">
                            <span>Poker</span>
                            <span className="text-xs text-slate-400 ml-2">(Coming Soon)</span>
                          </span>
                        </SelectItem>
                        <SelectItem value="tictactoe" disabled>
                          <span className="flex items-center justify-between w-full">
                            <span>Tic Tac Toe</span>
                            <span className="text-xs text-slate-400 ml-2">(Coming Soon)</span>
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="maxParticipants" className="text-sm font-medium">Players</Label>
                    {formData.gameType === "chess" ? (
                      <Input
                        id="maxParticipants"
                        type="text"
                        value="2"
                        disabled
                        className="bg-slate-700 border-slate-600 cursor-not-allowed"
                      />
                    ) : (
                      <Select 
                        value={formData.maxParticipants} 
                        onValueChange={(value) => setFormData({ ...formData, maxParticipants: value })}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-medium">Tournament Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Weekly Championship"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-700 border-slate-600 placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="entryFee" className="text-sm font-medium">Entry Fee ($)</Label>
                  <Input
                    id="entryFee"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="5.00"
                    value={formData.entryFee}
                    onChange={(e) => setFormData({ ...formData, entryFee: e.target.value })}
                    className="bg-slate-700 border-slate-600 placeholder:text-slate-400"
                  />
                </div>

                {formData.entryFee && parseFloat(formData.entryFee) > 0 && (
                  <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-emerald-400 mb-2">Tournament Financials</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-800/50 rounded p-2">
                        <p className="text-xs text-slate-400">Prize Pool</p>
                        <p className="text-base font-bold text-emerald-400">${calculatePrizePool()}</p>
                        <p className="text-xs text-slate-500">75% of total</p>
                      </div>
                      <div className="bg-slate-800/50 rounded p-2">
                        <p className="text-xs text-slate-400">Your Earnings</p>
                        <p className="text-base font-bold text-violet-400">${calculateAdminCommission()}</p>
                        <p className="text-xs text-slate-500">10% commission</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Total: ${((parseFloat(formData.entryFee) || 0) * (parseInt(formData.maxParticipants) || 0)).toFixed(2)} 
                      <span className="text-slate-600"> • </span>
                      {formData.maxParticipants} × ${(parseFloat(formData.entryFee) || 0).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 pt-3">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="border-slate-600 hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTournament}
                  disabled={createTournament.isPending || !formData.name || !formData.entryFee}
                  className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                >
                  {createTournament.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Tournament"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        {/* Filter Section */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {tournamentsLoading ? (
                <>
                  <Skeleton className="h-8 w-[90px] rounded-md" />
                  <Skeleton className="h-8 w-[110px] rounded-md" />
                  <Skeleton className="h-8 w-[105px] rounded-md" />
                  <Skeleton className="h-8 w-[75px] rounded-md" />
                </>
              ) : (
                <>
                  <Button
                    onClick={() => setStatusFilter("active")}
                    variant={statusFilter === "active" ? "default" : "outline"}
                    className={statusFilter === "active" 
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white" 
                      : "border-slate-600 text-slate-300 hover:bg-slate-700"}
                    size="sm"
                  >
                    Active ({statusCounts.active})
                  </Button>
                  <Button
                    onClick={() => setStatusFilter("completed")}
                    variant={statusFilter === "completed" ? "default" : "outline"}
                    className={statusFilter === "completed" 
                      ? "bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white" 
                      : "border-slate-600 text-slate-300 hover:bg-slate-700"}
                    size="sm"
                  >
                    Completed ({statusCounts.completed})
                  </Button>
                  <Button
                    onClick={() => setStatusFilter("cancelled")}
                    variant={statusFilter === "cancelled" ? "default" : "outline"}
                    className={statusFilter === "cancelled" 
                      ? "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white" 
                      : "border-slate-600 text-slate-300 hover:bg-slate-700"}
                    size="sm"
                  >
                    Cancelled ({statusCounts.cancelled})
                  </Button>
                  <Button
                    onClick={() => setStatusFilter("all")}
                    variant={statusFilter === "all" ? "default" : "outline"}
                    className={statusFilter === "all" 
                      ? "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white" 
                      : "border-slate-600 text-slate-300 hover:bg-slate-700"}
                    size="sm"
                  >
                    All ({statusCounts.all})
                  </Button>
                </>
              )}
            </div>
            
            {tournamentsLoading ? (
              <Skeleton className="h-9 w-[180px] rounded-xl" />
            ) : (
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline"
                      className="border-slate-600 text-slate-300 hover:bg-slate-700 px-4 py-2 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                      size="sm"
                    >
                      <HelpCircle className="w-4 h-4 mr-2" />
                      How It Works
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                        <Trophy className="h-6 w-6 text-yellow-500" />
                        How It Works
                      </DialogTitle>
                      <DialogDescription className="text-gray-300 text-base">
                        Quick guide to managing tournaments and earning commissions
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-5 mt-4">
                      {/* What This Platform Does */}
                      <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 p-4 rounded-lg border border-blue-700/50">
                        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                          <Users className="h-5 w-5 text-blue-400" />
                          What This Platform Does
                        </h3>
                        <p className="text-gray-200 text-sm leading-relaxed">
                          This platform lets you host gaming tournaments for your members. Members pay an entry fee, compete, and winners get prize money. 
                          You earn 10% commission from every game, keeping your community engaged while making money.
                        </p>
                      </div>

                      {/* Revenue Breakdown */}
                      <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-green-400" />
                          Where the Money Goes
                        </h3>
                        <div className="space-y-2 text-gray-200">
                          <p className="text-sm">Entry fees get split like this:</p>
                          <div className="bg-gray-800/50 rounded-lg p-3 space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-300">Prize Pool (Winner)</span>
                              <span className="font-bold text-green-400">75%</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-300">Your Commission</span>
                              <span className="font-bold text-violet-400">10%</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-300">Platform Fee</span>
                              <span className="font-bold text-gray-400">15%</span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-400 mt-2">
                            Your 10% is added to your balance automatically after each game. Withdraw anytime using the Withdraw button.
                          </p>
                        </div>
                      </div>

                      {/* Creating Tournaments */}
                      <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                          <Plus className="h-5 w-5 text-violet-400" />
                          Creating Tournaments
                        </h3>
                        <div className="space-y-2 text-gray-200">
                          <p className="text-sm">Click "Create Tournament" and set these up:</p>
                          <ul className="space-y-1.5 ml-4 text-sm">
                            <li className="flex items-start gap-2">
                              <span className="text-violet-400">•</span>
                              <span><strong>Game:</strong> Yahtzee, Chess, etc.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-violet-400">•</span>
                              <span><strong>Name:</strong> Something catchy for your tournament</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-violet-400">•</span>
                              <span><strong>Entry Fee:</strong> How much members pay to join</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-violet-400">•</span>
                              <span><strong>Players:</strong> 2-5 players (Chess is locked to 2)</span>
                            </li>
                          </ul>
                          <p className="text-sm text-gray-400 mt-2">
                            The form shows exactly how much the winner gets and how much you'll earn.
                          </p>
                        </div>
                      </div>

                      {/* How Tournaments Work */}
                      <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-purple-400" />
                          How Tournaments Work
                        </h3>
                        <div className="space-y-2 text-gray-200 text-sm">
                          <p><strong>After Creation:</strong> Your tournament shows up in the Active tab where members can join.</p>
                          <p><strong>Auto-Start:</strong> When the tournament fills up with all players, it automatically starts. No button needed.</p>
                          <p><strong>Games:</strong> Members play their games, and the winner gets the prize pool added to their balance.</p>
                          <p><strong>Your Cut:</strong> Your 10% commission gets added to your balance automatically.</p>
                          <p><strong>Cancelling:</strong> Cancel anytime before it fills up. Members get refunded automatically.</p>
                        </div>
                      </div>

                      {/* Notifying Members */}
                      <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                          <Bell className="h-5 w-5 text-blue-400" />
                          Notifying Members
                        </h3>
                        <div className="space-y-2 text-gray-200">
                          <p className="text-sm">
                            After creating a tournament, click <strong>"Notify All Members"</strong> in the success popup. 
                            This sends a push notification to everyone in your community about the new tournament.
                          </p>
                          <p className="text-sm text-gray-400">
                            You can only notify once per tournament, so make sure it's ready before sending.
                          </p>
                        </div>
                      </div>

                      {/* Quick Tips */}
                      <div className="bg-gradient-to-r from-green-900/40 to-teal-900/40 p-4 rounded-lg border border-green-700/50">
                        <h3 className="text-lg font-semibold text-white mb-2">Quick Tips</h3>
                        <ul className="space-y-1.5 text-gray-200 text-sm">
                          <li className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span>Host tournaments regularly to keep members active and maximize earnings</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span>Test different entry fees to find what works for your community</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span>Always notify members about new tournaments to boost participation</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span>Use the filter tabs (Active, Completed, Cancelled) to track everything</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span>Check your balance regularly and withdraw whenever you want</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button 
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 px-4 sm:px-6 py-2 rounded-xl font-semibold shadow-lg transition-all duration-200 hover:scale-105"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Tournament
                </Button>
              </div>
            )}
          </div>
        </div>

        {tournamentsLoading ? (
          <div className="grid gap-4 sm:gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700 shadow-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="bg-gradient-to-br from-slate-700/20 to-slate-800/20 border border-slate-600/30 rounded-xl p-3 sm:p-4 space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTournaments.length > 0 ? (
          <div className="grid gap-4 sm:gap-6">
            {filteredTournaments.map((tournament) => (
              <Card key={tournament.id} className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700 shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-[1.01]">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-white text-lg sm:text-xl font-bold mb-2">
                        {tournament.name}
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-sm flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        {tournament.gameType.charAt(0).toUpperCase() + tournament.gameType.slice(1)} Tournament
                        {tournament.description && <span className="text-slate-500">• {tournament.description}</span>}
                      </CardDescription>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(tournament.status)} text-white shadow-lg whitespace-nowrap flex-shrink-0`}>
                      {getStatusText(tournament.status)}
                    </span>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
                    <div className="bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/30 rounded-xl p-3 sm:p-4">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs sm:text-sm mb-1">
                        <DollarSign className="w-4 h-4" />
                        Prize Pool
                      </div>
                      <div className="text-white font-bold text-base sm:text-lg">
                        ${parseFloat(tournament.potAmount).toFixed(2)}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-blue-500/30 rounded-xl p-3 sm:p-4">
                      <div className="flex items-center gap-2 text-blue-400 text-xs sm:text-sm mb-1">
                        <DollarSign className="w-4 h-4" />
                        Entry Fee
                      </div>
                      <div className="text-white font-bold text-base sm:text-lg">
                        ${parseFloat(tournament.entryFee).toFixed(2)}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 rounded-xl p-3 sm:p-4">
                      <div className="flex items-center gap-2 text-violet-400 text-xs sm:text-sm mb-1">
                        <DollarSign className="w-4 h-4" />
                        {tournament.status === "completed" ? "Earnings" : "Est. Earnings"}
                      </div>
                      <div className="text-white font-bold text-base sm:text-lg">
                        ${(parseFloat(tournament.entryFee) * tournament.maxParticipants * ADMIN_COMMISSION_RATE).toFixed(2)}
                      </div>
                      <div className="text-violet-300 text-xs mt-1">
                        10% commission
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 rounded-xl p-3 sm:p-4">
                      <div className="flex items-center gap-2 text-amber-400 text-xs sm:text-sm mb-1">
                        <Users className="w-4 h-4" />
                        Players
                      </div>
                      <div className="text-white font-bold text-base sm:text-lg">
                        {tournament.currentParticipants}/{tournament.maxParticipants} joined
                      </div>
                      {(tournament.status === "active" || tournament.status === "started") && (
                        <div className="text-amber-300 text-xs mt-1">
                          {tournament.status === "started" 
                            ? "Game in progress" 
                            : tournament.currentParticipants === 0 
                              ? "Waiting for players" 
                              : "Auto-starts when full"}
                        </div>
                      )}
                    </div>
                  </div>

                  {(tournament.status === "active" || tournament.status === "started") && (
                    <div className="flex justify-end">
                      <Button
                        onClick={() => handleUpdateStatus(tournament.id, "cancelled")}
                        disabled={cancellingTournamentId === tournament.id}
                        className="bg-red-600 hover:bg-red-700 text-white shadow-lg transition-all duration-200 hover:scale-105"
                      >
                        {cancellingTournamentId === tournament.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Cancelling...
                          </>
                        ) : (
                          "Cancel Tournament"
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700 shadow-xl">
            <CardContent className="text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg">
                <Trophy className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                {statusFilter === "all" ? "No Tournaments Yet" : `No ${getStatusText(statusFilter)} Tournaments`}
              </h3>
              <p className="text-slate-400 mb-6 text-sm sm:text-base">
                {statusFilter === "all" 
                  ? "Create your first tournament to get started" 
                  : `There are no ${statusFilter} tournaments at this time`}
              </p>
              {(statusFilter === "all" || statusFilter === "active") && (
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 px-6 py-3 shadow-lg transition-all duration-200 hover:scale-105"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Tournament
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Success Modal */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent 
          className="bg-gray-800 border-gray-700 text-white max-w-2xl"
          hideCloseButton
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Tournament Created Successfully!</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Your tournament is now live and ready for your members
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {createdTournament && (
            <div className="space-y-4 py-4">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg p-4 space-y-3">
                <h3 className="text-xl font-bold text-white">{createdTournament.name}</h3>
                {createdTournament.description && (
                  <p className="text-sm text-gray-300">{createdTournament.description}</p>
                )}
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-900/50 rounded p-3">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Trophy className="h-3 w-3" />
                      <span>Game Type</span>
                    </div>
                    <p className="text-white font-semibold capitalize">{createdTournament.gameType}</p>
                  </div>
                  
                  <div className="bg-slate-900/50 rounded p-3">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Users className="h-3 w-3" />
                      <span>Max Players</span>
                    </div>
                    <p className="text-white font-semibold">{createdTournament.maxParticipants}</p>
                  </div>
                  
                  <div className="bg-slate-900/50 rounded p-3">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <DollarSign className="h-3 w-3" />
                      <span>Entry Fee</span>
                    </div>
                    <p className="text-emerald-400 font-bold">${createdTournament.entryFee}</p>
                  </div>
                  
                  <div className="bg-slate-900/50 rounded p-3">
                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                      <Trophy className="h-3 w-3" />
                      <span>Prize Pool</span>
                    </div>
                    <p className="text-emerald-400 font-bold">${createdTournament.potAmount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Bell className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-400 mb-1">Notify Team Members</h4>
                    <p className="text-xs text-gray-400 mb-3">
                      Send a notification to all members about this new tournament
                    </p>
                    <Button
                      onClick={handleNotifyMembers}
                      disabled={notifyMembers.isPending || createdTournament.notificationSent}
                      className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      size="sm"
                    >
                      {notifyMembers.isPending ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : createdTournament.notificationSent ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-2" />
                          Notification Sent
                        </>
                      ) : (
                        <>
                          <Bell className="w-3 h-3 mr-2" />
                          Notify All Members
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setIsSuccessDialogOpen(false)}
              className="bg-violet-600 hover:bg-violet-700 w-full"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
