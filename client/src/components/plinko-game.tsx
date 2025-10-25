import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Coins, Wallet, Plus } from "lucide-react";
import { useWhopUser } from "@/hooks/use-whop-user";
import { useWhopPayments } from "@/hooks/use-whop-payments";

interface PlinkoResult {
  slotIndex: number;
  multiplier: number;
  winAmount: number;
  newBalance: string;
}

interface BallPosition {
  x: number;
  y: number;
  row: number;
  pegIndex: number;
}

const API_BASE_URL = "";

async function playPlinko(betAmount: number): Promise<PlinkoResult> {
  const response = await fetch(`${API_BASE_URL}/api/games/plinko/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ betAmount }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to play Plinko");
  }

  return response.json();
}

export default function PlinkoGame({ onBack }: { onBack: () => void }) {
  const [selectedBet, setSelectedBet] = useState<number>(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastResult, setLastResult] = useState<PlinkoResult | null>(null);
  const [ballPosition, setBallPosition] = useState<BallPosition | null>(null);
  const [hitPegs, setHitPegs] = useState<Set<string>>(new Set());
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const audioContextRef = useRef<AudioContext | null>(null);
  const { user } = useWhopUser();
  const { makePayment, isPaymentPending, isRealPaymentsAvailable } = useWhopPayments();

  const betOptions = [0.25, 0.50, 1.00, 2.00, 5.00];
  const multipliers = [5.0, 2.5, 1.5, 1.0, 0.5, 0.5, 1.0, 1.5, 2.5, 5.0];
  const rows = 8;

  const initAudioContext = () => {
    if (typeof window !== 'undefined' && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const playPegSound = () => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = 400 + Math.random() * 200;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  };

  const playWinSound = () => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator1 = ctx.createOscillator();
    const oscillator2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator1.frequency.value = 523.25;
    oscillator2.frequency.value = 659.25;
    oscillator1.type = 'sine';
    oscillator2.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    oscillator1.start(ctx.currentTime);
    oscillator2.start(ctx.currentTime);
    oscillator1.stop(ctx.currentTime + 0.5);
    oscillator2.stop(ctx.currentTime + 0.5);
  };

  const playLoseSound = () => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.setValueAtTime(300, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  };

  const getPegsInRow = (rowIndex: number) => {
    return 3 + rowIndex;
  };

  const getPegPositions = (rowIndex: number) => {
    const pegsInRow = getPegsInRow(rowIndex);
    const positions = [];
    const maxPegs = getPegsInRow(rows - 1);
    const spacing = 100 / (maxPegs + 1);
    
    const offset = (maxPegs - pegsInRow) * spacing / 2;
    
    for (let i = 0; i < pegsInRow; i++) {
      positions.push(offset + spacing * (i + 1));
    }
    
    return positions;
  };

  const animateBallDrop = async (finalSlot: number, resultData: PlinkoResult) => {
    setIsAnimating(true);
    setHitPegs(new Set());
    
    const pegYSpacing = 40;
    const maxPegs = getPegsInRow(rows - 1);
    const finalPegPositions = getPegPositions(rows - 1);
    const targetX = finalPegPositions[Math.min(finalSlot, finalPegPositions.length - 1)];
    
    let currentX = 50;
    let currentY = -20;
    const newHitPegs = new Set<string>();
    
    for (let row = 0; row < rows; row++) {
      const pegPositions = getPegPositions(row);
      const rowY = row * pegYSpacing + 25;
      
      let closestPegIndex = 0;
      let minDistance = Infinity;
      pegPositions.forEach((pegX, index) => {
        const distance = Math.abs(pegX - currentX);
        if (distance < minDistance) {
          minDistance = distance;
          closestPegIndex = index;
        }
      });
      
      const targetPegX = pegPositions[closestPegIndex];
      
      const steps = 8;
      for (let step = 0; step < steps; step++) {
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const progress = (step + 1) / steps;
        const newY = currentY + (rowY - currentY) * progress;
        const newX = currentX + (targetPegX - currentX) * progress;
        
        setBallPosition({
          x: newX,
          y: newY,
          row,
          pegIndex: closestPegIndex
        });
      }
      
      playPegSound();
      const pegKey = `${row}-${closestPegIndex}`;
      newHitPegs.add(pegKey);
      setHitPegs(new Set(newHitPegs));
      
      currentX = targetPegX;
      currentY = rowY;
      
      if (row < rows - 1) {
        const nextPegPositions = getPegPositions(row + 1);
        const deviation = Math.random() < 0.5 ? -1 : 1;
        const nextPegIndex = Math.max(0, Math.min(nextPegPositions.length - 1, closestPegIndex + deviation));
        
        const remainingRows = rows - row - 1;
        const currentTargetIndex = nextPegPositions.findIndex((x, idx) => {
          const nextRowTargetX = targetX;
          return Math.abs(x - nextRowTargetX) === Math.min(...nextPegPositions.map(px => Math.abs(px - nextRowTargetX)));
        });
        
        const directionToTarget = currentTargetIndex > nextPegIndex ? 1 : currentTargetIndex < nextPegIndex ? -1 : 0;
        
        if (remainingRows > 3 && Math.random() < 0.7 && directionToTarget !== 0) {
          currentX = nextPegPositions[Math.max(0, Math.min(nextPegPositions.length - 1, nextPegIndex + directionToTarget))];
        } else {
          currentX = nextPegPositions[nextPegIndex];
        }
      }
    }
    
    const slotY = rows * pegYSpacing + 60;
    const slotSpacing = 100 / (multipliers.length + 1);
    const finalSlotX = slotSpacing * (finalSlot + 1);
    
    const steps = 10;
    for (let step = 0; step < steps; step++) {
      await new Promise(resolve => setTimeout(resolve, 30));
      const progress = (step + 1) / steps;
      const newY = currentY + (slotY - currentY) * progress;
      const newX = currentX + (finalSlotX - currentX) * progress;
      
      setBallPosition({
        x: newX,
        y: newY,
        row: rows,
        pegIndex: finalSlot
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setLastResult(resultData);
    
    setIsAnimating(false);
    setBallPosition(null);
    setHitPegs(new Set());
  };

  const playMutation = useMutation({
    mutationFn: (betAmount: number) => playPlinko(betAmount),
    onSuccess: async (data) => {
      await animateBallDrop(data.slotIndex, data);
      queryClient.invalidateQueries({ queryKey: ["/api/whop/user"] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/user", user.id] });
      }
      
      if (data.winAmount > selectedBet) {
        playWinSound();
        const profit = data.winAmount - selectedBet;
        let winTitle = "";
        let winDescription = "";
        
        if (data.multiplier >= 5.0) {
          winTitle = `🎰💰 MEGA WIN! $${data.winAmount.toFixed(2)}! 💰🎰`;
          winDescription = `🔥 ${data.multiplier}x MULTIPLIER! +$${profit.toFixed(2)} profit! 🔥`;
        } else if (data.multiplier >= 2.5) {
          winTitle = `🎉💎 BIG WIN! $${data.winAmount.toFixed(2)}! 💎🎉`;
          winDescription = `✨ ${data.multiplier}x multiplier! +$${profit.toFixed(2)} profit! ✨`;
        } else if (data.multiplier >= 1.5) {
          winTitle = `🎊 NICE WIN! $${data.winAmount.toFixed(2)}! 🎊`;
          winDescription = `⭐ ${data.multiplier}x multiplier! +$${profit.toFixed(2)} profit! ⭐`;
        } else {
          winTitle = `🎉 You Won! $${data.winAmount.toFixed(2)}! 🎉`;
          winDescription = `💫 ${data.multiplier}x multiplier! +$${profit.toFixed(2)} profit! 💫`;
        }
        
        toast({
          title: winTitle,
          description: winDescription,
          variant: "success",
        });
      } else {
        playLoseSound();
        toast({
          title: `You Lost`,
          description: `Won $${data.winAmount.toFixed(2)} (${data.multiplier}x multiplier)`,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsAnimating(false);
    },
  });

  const handlePlay = () => {
    if (isAnimating) return;
    initAudioContext();
    setLastResult(null);
    playMutation.mutate(selectedBet);
  };

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

  const getSlotColor = (index: number) => {
    const mult = multipliers[index];
    if (mult >= 3) return "bg-gradient-to-b from-amber-400 to-yellow-500 text-black";
    if (mult >= 1.5) return "bg-gradient-to-b from-emerald-400 to-green-500 text-white";
    if (mult >= 1) return "bg-gradient-to-b from-blue-400 to-blue-500 text-white";
    if (mult >= 0.5) return "bg-gradient-to-b from-orange-400 to-red-500 text-white";
    return "bg-gradient-to-b from-red-500 to-red-700 text-white";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 p-2 sm:p-3">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-0 mb-3">
          <Button 
            onClick={onBack} 
            variant="outline" 
            className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-xs sm:text-sm py-2 w-full sm:w-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
            Back to Lobby
          </Button>
          
          {user && (
            <div className="w-full sm:w-auto">
              {showAddFunds ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2 sm:px-3 py-2">
                    <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
                    <div className="flex flex-col">
                      <span className="text-[10px] sm:text-xs text-slate-400">Balance</span>
                      <span className="text-sm sm:text-base font-bold text-green-400">${parseFloat(user.balance).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => handleAddFunds(5)}
                      disabled={(pendingAmount === 5) || !isRealPaymentsAvailable}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 sm:px-2.5 py-1.5 rounded text-xs sm:text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1 flex-1 sm:flex-none" 
                    >
                      {pendingAmount === 5 ? <Loader2 className="w-3 h-3 animate-spin" /> : "$5"}
                    </button>
                    <button 
                      onClick={() => handleAddFunds(10)}
                      disabled={(pendingAmount === 10) || !isRealPaymentsAvailable}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 sm:px-2.5 py-1.5 rounded text-xs sm:text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1 flex-1 sm:flex-none" 
                    >
                      {pendingAmount === 10 ? <Loader2 className="w-3 h-3 animate-spin" /> : "$10"}
                    </button>
                    <button 
                      onClick={() => handleAddFunds(25)}
                      disabled={(pendingAmount === 25) || !isRealPaymentsAvailable}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 sm:px-2.5 py-1.5 rounded text-xs sm:text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1 flex-1 sm:flex-none" 
                    >
                      {pendingAmount === 25 ? <Loader2 className="w-3 h-3 animate-spin" /> : "$25"}
                    </button>
                    <button 
                      onClick={() => handleAddFunds(50)}
                      disabled={(pendingAmount === 50) || !isRealPaymentsAvailable}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 sm:px-2.5 py-1.5 rounded text-xs sm:text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1 flex-1 sm:flex-none" 
                    >
                      {pendingAmount === 50 ? <Loader2 className="w-3 h-3 animate-spin" /> : "$50"}
                    </button>
                    <button 
                      onClick={() => setShowAddFunds(false)}
                      className="bg-red-500 hover:bg-red-600 text-white px-2 sm:px-2.5 py-1.5 rounded text-xs sm:text-sm font-semibold"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2 sm:px-3 py-2">
                  <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
                  <div className="flex flex-col">
                    <span className="text-[10px] sm:text-xs text-slate-400">Balance</span>
                    <span className="text-sm sm:text-base font-bold text-green-400">${parseFloat(user.balance).toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => setShowAddFunds(true)}
                    className="bg-violet-500 hover:bg-violet-600 text-white p-1.5 rounded-lg transition-all duration-200 ml-2" 
                  >
                    <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="md:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="py-2 sm:py-3">
                <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
                  <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
                  Plinko - Drop & Win!
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 sm:py-3">
                <div className="relative bg-gradient-to-b from-slate-900 to-slate-800 rounded-xl p-2 sm:p-4 min-h-[400px] sm:min-h-[480px] overflow-hidden">
                  <div className="relative" style={{ height: `${rows * 40 + 120}px` }}>
                    {Array.from({ length: rows }).map((_, rowIndex) => {
                      const pegPositions = getPegPositions(rowIndex);
                      return (
                        <div
                          key={rowIndex}
                          className="absolute w-full"
                          style={{ top: `${rowIndex * 40 + 25}px` }}
                        >
                          {pegPositions.map((xPosition, pegIndex) => {
                            const pegKey = `${rowIndex}-${pegIndex}`;
                            const isHit = hitPegs.has(pegKey);
                            return (
                              <div
                                key={pegIndex}
                                className={`absolute w-3 h-3 rounded-full transition-all duration-200 ${
                                  isHit
                                    ? "bg-yellow-400 shadow-lg shadow-yellow-400/50 scale-150"
                                    : "bg-slate-600 shadow-md"
                                }`}
                                style={{
                                  left: `${xPosition}%`,
                                  transform: `translateX(-50%) ${isHit ? 'scale(1.5)' : 'scale(1)'}`,
                                }}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                    
                    {ballPosition && (
                      <div
                        className="absolute w-5 h-5 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-orange-500 shadow-xl shadow-yellow-500/50 transition-all duration-75 ease-linear z-10"
                        style={{
                          left: `${ballPosition.x}%`,
                          top: `${ballPosition.y}px`,
                          transform: 'translate(-50%, -50%)',
                          boxShadow: '0 0 20px rgba(251, 191, 36, 0.6), 0 0 40px rgba(251, 191, 36, 0.4)',
                        }}
                      >
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 to-transparent" />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center gap-1 sm:gap-1.5 mt-3 sm:mt-4">
                    {multipliers.map((mult, index) => (
                      <div
                        key={index}
                        className={`w-8 h-12 sm:w-12 sm:h-16 rounded-lg flex flex-col items-center justify-center font-bold ${getSlotColor(
                          index
                        )} ${
                          lastResult?.slotIndex === index
                            ? "ring-2 ring-white scale-110 shadow-xl"
                            : ""
                        } transition-all duration-300`}
                      >
                        <div className="text-sm sm:text-lg">{mult}x</div>
                        {lastResult?.slotIndex === index && (
                          <div className="text-[8px] sm:text-[10px] mt-0.5">${lastResult.winAmount.toFixed(2)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-1">
            <Card className="bg-slate-800 border-slate-700 md:sticky md:top-3">
              <CardHeader className="py-2 sm:py-3">
                <CardTitle className="text-white text-sm sm:text-base">Place Your Bet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3 py-2 sm:py-3">
                <div>
                  <label className="text-slate-300 text-xs sm:text-sm mb-1.5 sm:mb-2 block">Bet Amount</label>
                  <div className="grid grid-cols-3 sm:grid-cols-2 gap-1.5 sm:gap-2">
                    {betOptions.map((bet) => (
                      <Button
                        key={bet}
                        onClick={() => setSelectedBet(bet)}
                        variant={selectedBet === bet ? "default" : "outline"}
                        className={`py-2 sm:py-3 text-xs sm:text-sm ${
                          selectedBet === bet
                            ? "bg-gradient-to-r from-violet-500 to-purple-600"
                            : "bg-slate-700 border-slate-600 hover:bg-slate-600"
                        }`}
                        disabled={isAnimating}
                      >
                        ${bet.toFixed(2)}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handlePlay}
                  disabled={isAnimating || playMutation.isPending}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white py-3 sm:py-4 text-sm sm:text-base font-bold"
                >
                  {isAnimating || playMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 animate-spin" />
                      Dropping...
                    </>
                  ) : (
                    `Drop Ball - $${selectedBet.toFixed(2)}`
                  )}
                </Button>

                {lastResult && (
                  <div className="bg-slate-900 rounded-lg p-2 sm:p-2.5 border border-slate-700">
                    <div className="text-slate-400 text-[10px] sm:text-xs mb-1 sm:mb-1.5">Last Result</div>
                    <div className="flex justify-between items-center">
                      <span className="text-white text-[10px] sm:text-xs font-semibold">Multiplier:</span>
                      <span className="text-yellow-400 text-xs sm:text-sm font-bold">
                        {lastResult.multiplier}x
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-0.5 sm:mt-1">
                      <span className="text-white text-[10px] sm:text-xs font-semibold">Won:</span>
                      <span
                        className={`text-xs sm:text-sm font-bold ${
                          lastResult.winAmount > selectedBet ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        ${lastResult.winAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-0.5 sm:mt-1">
                      <span className="text-white text-[10px] sm:text-xs font-semibold">Profit:</span>
                      <span
                        className={`text-xs sm:text-sm font-bold ${
                          lastResult.winAmount > selectedBet ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {lastResult.winAmount > selectedBet ? "+" : ""}$
                        {(lastResult.winAmount - selectedBet).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-700">
                  <div className="text-slate-400 text-[10px] mb-1.5">Payout Table</div>
                  <div className="space-y-0.5">
                    {multipliers.map((mult, index) => (
                      <div key={index} className="flex justify-between text-[10px]">
                        <span className="text-slate-400">Slot {index + 1}:</span>
                        <span className="text-white font-semibold">{mult}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
