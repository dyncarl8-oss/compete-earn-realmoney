import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Dice1, Wallet, Plus } from "lucide-react";
import { useWhopUser } from "@/hooks/use-whop-user";
import { useWhopPayments } from "@/hooks/use-whop-payments";

interface DiceResult {
  rolledNumber: number;
  isWin: boolean;
  multiplier: number;
  winAmount: number;
  newBalance: string;
}

const API_BASE_URL = "";

async function playDice(betAmount: number, targetNumber: number, rollType: string): Promise<DiceResult> {
  const response = await fetch(`${API_BASE_URL}/api/games/dice/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ betAmount, targetNumber, rollType }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to play Dice");
  }

  return response.json();
}

export default function DiceGame({ onBack }: { onBack: () => void }) {
  const [selectedBet, setSelectedBet] = useState<number>(1);
  const [targetNumber, setTargetNumber] = useState<number>(50);
  const [rollType, setRollType] = useState<"over" | "under">("over");
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<DiceResult | null>(null);
  const [displayNumber, setDisplayNumber] = useState<number>(50);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useWhopUser();
  const audioContextRef = useRef<AudioContext | null>(null);
  const { makePayment, isPaymentPending, isRealPaymentsAvailable } = useWhopPayments();

  const betOptions = [0.25, 0.50, 1.00, 2.00, 5.00];

  // Calculate multiplier and win chance for display
  const winChance = rollType === "under" ? targetNumber : (100 - targetNumber);
  const potentialMultiplier = ((100 / winChance) * 0.96).toFixed(2);

  const initAudioContext = () => {
    if (typeof window !== 'undefined' && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const playRollSound = () => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = 200 + Math.random() * 100;
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
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

  const playMutation = useMutation({
    mutationFn: () => playDice(selectedBet, targetNumber, rollType),
    onSuccess: (data) => {
      setLastResult(data);
      animateRoll(data.rolledNumber, data.isWin);
      
      // Invalidate queries immediately so balance updates even if user navigates away
      queryClient.invalidateQueries({ queryKey: ["/api/whop/user"] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/user", user.id] });
      }
      
      setTimeout(() => {
        if (data.isWin) {
          const profit = data.winAmount - selectedBet;
          let winTitle = "";
          let winDescription = "";
          
          if (data.multiplier >= 10) {
            winTitle = `🎰💰 JACKPOT! $${data.winAmount.toFixed(2)}! 💰🎰`;
            winDescription = `🔥 Rolled ${data.rolledNumber}! ${data.multiplier.toFixed(2)}x INSANE multiplier! +$${profit.toFixed(2)} profit! 🔥`;
          } else if (data.multiplier >= 5) {
            winTitle = `🎉💎 HUGE WIN! $${data.winAmount.toFixed(2)}! 💎🎉`;
            winDescription = `✨ Rolled ${data.rolledNumber}! ${data.multiplier.toFixed(2)}x multiplier! +$${profit.toFixed(2)} profit! ✨`;
          } else if (data.multiplier >= 3) {
            winTitle = `🎊 BIG WIN! $${data.winAmount.toFixed(2)}! 🎊`;
            winDescription = `⭐ Rolled ${data.rolledNumber}! ${data.multiplier.toFixed(2)}x multiplier! +$${profit.toFixed(2)} profit! ⭐`;
          } else {
            winTitle = `🎉 Winner! $${data.winAmount.toFixed(2)}! 🎉`;
            winDescription = `💫 Rolled ${data.rolledNumber}! ${data.multiplier.toFixed(2)}x multiplier! +$${profit.toFixed(2)} profit! 💫`;
          }
          
          toast({
            title: winTitle,
            description: winDescription,
            variant: "success",
          });
        } else {
          toast({
            title: "You Lost",
            description: `Rolled ${data.rolledNumber}`,
            variant: "destructive",
          });
        }
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsRolling(false);
    },
  });

  const animateRoll = async (finalNumber: number, isWin: boolean) => {
    setIsRolling(true);
    
    // Animate rolling numbers with sound
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 80));
      setDisplayNumber(Math.floor(Math.random() * 100) + 1);
      playRollSound();
    }
    
    // Show final number
    setDisplayNumber(finalNumber);
    
    // Play win or lose sound
    if (isWin) {
      playWinSound();
    } else {
      playLoseSound();
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsRolling(false);
  };

  const handlePlay = () => {
    if (isRolling) return;
    initAudioContext();
    setLastResult(null);
    playMutation.mutate();
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-900 to-slate-900 p-3">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-3">
          <Button 
            onClick={onBack} 
            variant="outline" 
            className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-sm py-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Lobby
          </Button>
          
          {user && (
            <div>
              {showAddFunds ? (
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                    <Wallet className="w-4 h-4 text-green-400" />
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400">Balance</span>
                      <span className="text-base font-bold text-green-400">${parseFloat(user.balance).toFixed(2)}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAddFunds(5)}
                    disabled={(pendingAmount === 5) || !isRealPaymentsAvailable}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1" 
                  >
                    {pendingAmount === 5 ? <Loader2 className="w-3 h-3 animate-spin" /> : "$5"}
                  </button>
                  <button 
                    onClick={() => handleAddFunds(10)}
                    disabled={(pendingAmount === 10) || !isRealPaymentsAvailable}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1" 
                  >
                    {pendingAmount === 10 ? <Loader2 className="w-3 h-3 animate-spin" /> : "$10"}
                  </button>
                  <button 
                    onClick={() => handleAddFunds(25)}
                    disabled={(pendingAmount === 25) || !isRealPaymentsAvailable}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1" 
                  >
                    {pendingAmount === 25 ? <Loader2 className="w-3 h-3 animate-spin" /> : "$25"}
                  </button>
                  <button 
                    onClick={() => handleAddFunds(50)}
                    disabled={(pendingAmount === 50) || !isRealPaymentsAvailable}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1" 
                  >
                    {pendingAmount === 50 ? <Loader2 className="w-3 h-3 animate-spin" /> : "$50"}
                  </button>
                  <button 
                    onClick={() => setShowAddFunds(false)}
                    className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm font-semibold"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                  <Wallet className="w-4 h-4 text-green-400" />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">Balance</span>
                    <span className="text-base font-bold text-green-400">${parseFloat(user.balance).toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => setShowAddFunds(true)}
                    className="bg-violet-500 hover:bg-violet-600 text-white p-1.5 rounded-lg transition-all duration-200 ml-2" 
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Game Area */}
          <div className="md:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="py-3">
                <CardTitle className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                  Dice Roll
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 py-3">
                {/* Dice Display */}
                <div className="flex items-center justify-center py-6">
                  <div className={`relative ${isRolling ? 'animate-spin' : ''}`}>
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-xl">
                      <span className="text-4xl font-bold text-white">
                        {displayNumber}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Target Number Control */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-sm font-medium">Target Number:</span>
                    <span className="text-xl font-bold text-blue-400">{targetNumber}</span>
                  </div>
                  <Slider
                    value={[targetNumber]}
                    onValueChange={(val) => setTargetNumber(val[0])}
                    min={1}
                    max={99}
                    step={1}
                    disabled={isRolling}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>1</span>
                    <span>50</span>
                    <span>99</span>
                  </div>
                </div>

                {/* Roll Type Selection */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => setRollType("under")}
                    disabled={isRolling}
                    variant={rollType === "under" ? "default" : "outline"}
                    className={`flex-1 py-3 text-sm ${rollType === "under" ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'border-slate-600'}`}
                  >
                    Roll UNDER {targetNumber}
                  </Button>
                  <Button
                    onClick={() => setRollType("over")}
                    disabled={isRolling}
                    variant={rollType === "over" ? "default" : "outline"}
                    className={`flex-1 py-3 text-sm ${rollType === "over" ? 'bg-gradient-to-r from-orange-500 to-red-600' : 'border-slate-600'}`}
                  >
                    Roll OVER {targetNumber}
                  </Button>
                </div>

                {/* Win Chance & Multiplier Display */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-900/50 rounded-lg">
                  <div>
                    <div className="text-slate-400 text-xs">Win Chance</div>
                    <div className="text-lg font-bold text-green-400">{winChance}%</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Multiplier</div>
                    <div className="text-lg font-bold text-blue-400">{potentialMultiplier}x</div>
                  </div>
                </div>

                {/* Last Result */}
                {lastResult && !isRolling && (
                  <div className={`p-2.5 rounded-lg ${lastResult.isWin ? 'bg-green-500/20 border border-green-500' : 'bg-red-500/20 border border-red-500'}`}>
                    <div className="text-center">
                      <div className="text-xs text-slate-300">Last Roll</div>
                      <div className="text-xl font-bold mt-1">
                        {lastResult.isWin ? (
                          <span className="text-green-400">WON ${lastResult.winAmount.toFixed(2)}</span>
                        ) : (
                          <span className="text-red-400">LOST</span>
                        )}
                      </div>
                      <div className="text-slate-400 text-xs mt-0.5">Rolled {lastResult.rolledNumber}</div>
                    </div>
                  </div>
                )}

                {/* Play Button */}
                <Button
                  onClick={handlePlay}
                  disabled={isRolling || playMutation.isPending}
                  className="w-full py-4 text-base font-bold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {isRolling || playMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Rolling...
                    </>
                  ) : (
                    <>
                      <Dice1 className="w-4 h-4 mr-2" />
                      Roll Dice - ${selectedBet.toFixed(2)}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Controls Panel */}
          <div className="space-y-4">
            {/* Bet Amount Selection */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Bet Amount</CardTitle>
              </CardHeader>
              <CardContent className="py-3">
                <div className="grid grid-cols-2 gap-2">
                  {betOptions.map((amount) => (
                    <Button
                      key={amount}
                      onClick={() => setSelectedBet(amount)}
                      disabled={isRolling}
                      variant={selectedBet === amount ? "default" : "outline"}
                      className={`py-3 text-sm ${selectedBet === amount ? "bg-gradient-to-r from-blue-500 to-purple-600" : "border-slate-600"}`}
                    >
                      ${amount.toFixed(2)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* How to Play */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="py-3">
                <CardTitle className="text-base">How to Play</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-300 space-y-1.5 py-3">
                <p>1. Choose your bet amount</p>
                <p>2. Set a target number (1-99)</p>
                <p>3. Choose to roll OVER or UNDER that number</p>
                <p>4. Higher risk = Higher multiplier!</p>
                <p className="text-blue-400 font-medium mt-2 text-xs">96% RTP • 4% House Edge</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
