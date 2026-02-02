import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Coins, Wallet, Plus } from "lucide-react";
import { useWhopUser } from "@/hooks/use-whop-user";
import { useWhopPayments } from "@/hooks/use-whop-payments";

interface SlotsResult {
  reels: string[];
  multiplier: number;
  winAmount: number;
  newBalance: string;
  isWin: boolean;
}

const API_BASE_URL = "";

async function playSlots(betAmount: number): Promise<SlotsResult> {
  const response = await fetch(`${API_BASE_URL}/api/games/slots/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ betAmount }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to play Slots");
  }

  return response.json();
}

const SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "💎", "7️⃣", "⭐"];
const REEL_HEIGHT = 80;
const SYMBOL_HEIGHT = 80;

export default function SlotsGame({ onBack }: { onBack: () => void }) {
  const [selectedBet, setSelectedBet] = useState<number>(1);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<SlotsResult | null>(null);
  const [reelPositions, setReelPositions] = useState([0, 0, 0]);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const audioContextRef = useRef<AudioContext | null>(null);
  const { user } = useWhopUser();
  const { makePayment, isPaymentPending, isRealPaymentsAvailable } = useWhopPayments();

  const betOptions = [0.25, 0.50, 1.00, 2.00, 5.00];

  const initAudioContext = () => {
    if (typeof window !== 'undefined' && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const playSpinSound = () => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = 100;
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  };

  const playWinSound = () => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const notes = [523.25, 587.33, 659.25, 783.99];
    
    notes.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';
      
      const startTime = ctx.currentTime + index * 0.1;
      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.4);
    });
  };

  const playLoseSound = () => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.setValueAtTime(300, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.4);
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  };

  const animateReels = async (finalReels: string[], resultData: SlotsResult) => {
    setIsSpinning(true);
    
    const spinDurations = [1500, 1800, 2100];
    const finalPositions = finalReels.map(symbol => SYMBOLS.indexOf(symbol));
    
    const spinPromises = finalPositions.map(async (finalPos, reelIndex) => {
      const spinDuration = spinDurations[reelIndex];
      const startTime = Date.now();
      const rotations = 3;
      const totalDistance = rotations * SYMBOLS.length + finalPos;
      
      while (Date.now() - startTime < spinDuration) {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / spinDuration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentPos = easeOut * totalDistance;
        
        setReelPositions(prev => {
          const newPositions = [...prev];
          newPositions[reelIndex] = currentPos;
          return newPositions;
        });
        
        if (elapsed % 100 < 20) {
          playSpinSound();
        }
        
        await new Promise(resolve => setTimeout(resolve, 16));
      }
      
      setReelPositions(prev => {
        const newPositions = [...prev];
        newPositions[reelIndex] = rotations * SYMBOLS.length + finalPos;
        return newPositions;
      });
    });
    
    await Promise.all(spinPromises);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setLastResult(resultData);
    setIsSpinning(false);
  };

  const playMutation = useMutation({
    mutationFn: (betAmount: number) => playSlots(betAmount),
    onSuccess: async (data) => {
      await animateReels(data.reels, data);
      queryClient.invalidateQueries({ queryKey: ["/api/whop/user"] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/user", user.id] });
      }
      
      if (data.isWin) {
        playWinSound();
        const profit = data.winAmount - selectedBet;
        let winTitle = "";
        let winDescription = "";
        
        if (data.multiplier >= 50) {
          winTitle = `🎰💰 JACKPOT! $${data.winAmount.toFixed(2)}! 💰🎰`;
          winDescription = `🔥 ${data.multiplier}x MASSIVE WIN! +$${profit.toFixed(2)} profit! 🔥`;
        } else if (data.multiplier >= 25) {
          winTitle = `🎉💎 MEGA WIN! $${data.winAmount.toFixed(2)}! 💎🎉`;
          winDescription = `✨ ${data.multiplier}x multiplier! +$${profit.toFixed(2)} profit! ✨`;
        } else if (data.multiplier >= 10) {
          winTitle = `🎊 BIG WIN! $${data.winAmount.toFixed(2)}! 🎊`;
          winDescription = `⭐ ${data.multiplier}x multiplier! +$${profit.toFixed(2)} profit! ⭐`;
        } else if (data.multiplier >= 3) {
          winTitle = `🎉 NICE WIN! $${data.winAmount.toFixed(2)}! 🎉`;
          winDescription = `💫 ${data.multiplier}x multiplier! +$${profit.toFixed(2)} profit! 💫`;
        } else {
          winTitle = `✨ You Won! $${data.winAmount.toFixed(2)}! ✨`;
          winDescription = `🎯 ${data.multiplier}x multiplier! +$${profit.toFixed(2)} profit! 🎯`;
        }
        
        toast({
          title: winTitle,
          description: winDescription,
          variant: "success",
        });
      } else {
        playLoseSound();
        toast({
          title: "No Win This Time",
          description: "Spin again for another chance!",
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
      setIsSpinning(false);
    },
  });

  const handlePlay = () => {
    if (isSpinning) return;
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
    } finally {
      setPendingAmount(null);
    }
  };

  const getSymbolStyle = (reelIndex: number, symbolIndex: number) => {
    const position = reelPositions[reelIndex] % SYMBOLS.length;
    const offset = (symbolIndex - position) * SYMBOL_HEIGHT;
    const wrappedOffset = offset < -SYMBOL_HEIGHT ? offset + SYMBOLS.length * SYMBOL_HEIGHT : offset;
    
    return {
      transform: `translateY(${wrappedOffset}px)`,
      transition: isSpinning ? 'none' : 'transform 0.3s ease-out',
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-rose-900 to-slate-900 p-2 sm:p-3">
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
                  Slots - Spin to Win!
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 sm:py-3">
                <div className="relative bg-gradient-to-b from-slate-900 to-slate-800 rounded-xl p-4 sm:p-6">
                  <div className="flex justify-center gap-2 sm:gap-4 mb-4">
                    {[0, 1, 2].map((reelIndex) => (
                      <div 
                        key={reelIndex}
                        className="relative w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-b from-slate-700 to-slate-800 rounded-xl overflow-hidden border-4 border-yellow-500/30 shadow-xl"
                      >
                        <div className="absolute inset-0 overflow-hidden">
                          {SYMBOLS.map((symbol, symbolIndex) => (
                            <div
                              key={symbolIndex}
                              className="absolute w-full h-20 sm:h-24 flex items-center justify-center text-4xl sm:text-5xl"
                              style={getSymbolStyle(reelIndex, symbolIndex)}
                            >
                              {symbol}
                            </div>
                          ))}
                        </div>
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-slate-800 to-transparent"></div>
                          <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-slate-800 to-transparent"></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {lastResult && !isSpinning && (
                    <div className={`p-3 sm:p-4 rounded-lg border-2 mb-4 ${
                      lastResult.isWin 
                        ? 'bg-emerald-500/20 border-emerald-500' 
                        : 'bg-slate-700/50 border-slate-600'
                    }`}>
                      <div className="text-center">
                        <div className="text-xs sm:text-sm text-slate-300 mb-1">Last Spin Result</div>
                        {lastResult.isWin ? (
                          <>
                            <div className="text-2xl sm:text-3xl font-bold text-emerald-400 mb-1">
                              WON ${lastResult.winAmount.toFixed(2)}!
                            </div>
                            <div className="text-sm sm:text-base text-emerald-300">
                              {lastResult.multiplier}x Multiplier
                            </div>
                          </>
                        ) : (
                          <div className="text-lg sm:text-xl font-bold text-slate-400">
                            No Match - Try Again!
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-900/50 rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-slate-300">
                    <div className="font-bold text-yellow-400 mb-2">Winning Combinations:</div>
                    <div className="space-y-1">
                      <div className="font-semibold text-yellow-300 mt-1">3 Matching Symbols:</div>
                      <div>🎰 Three 7️⃣ = 530x (Jackpot!)</div>
                      <div>💎 Three 💎 = 210x</div>
                      <div>⭐ Three ⭐ = 82x</div>
                      <div>🍇 Three 🍇 = 43x</div>
                      <div>🍊 Three 🍊 = 27x</div>
                      <div>🍋 Three 🍋 = 16x</div>
                      <div>🍒 Three 🍒 = 10x</div>
                      <div className="font-semibold text-yellow-300 mt-2">2 Matching Symbols:</div>
                      <div>🍒 Two 🍒 = 0.5x</div>
                      <div>🍋 Two 🍋 = 0.3x</div>
                      <div>🍊 Two 🍊 = 0.2x</div>
                    </div>
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
                        disabled={isSpinning}
                      >
                        ${bet.toFixed(2)}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handlePlay}
                  disabled={isSpinning || playMutation.isPending}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white py-3 sm:py-4 text-sm sm:text-base font-bold"
                >
                  {isSpinning || playMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 animate-spin" />
                      Spinning...
                    </>
                  ) : (
                    `Spin - $${selectedBet.toFixed(2)}`
                  )}
                </Button>

                <div className="bg-slate-900/50 rounded-lg p-2 sm:p-3 text-xs text-slate-400">
                  <div className="font-semibold text-blue-400 mb-1">Game Info:</div>
                  <div>95% RTP (Return to Player)</div>
                  <div>5% House Edge</div>
                  <div className="mt-2 text-yellow-400">Up to 50x Multiplier!</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
