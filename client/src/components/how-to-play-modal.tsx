import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HelpCircle, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Trophy, DollarSign, Clock, Users, Shield, Star, TrendingUp, CheckCircle } from "lucide-react";

export function HowToPlayModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg flex items-center justify-center gap-3">
          <HelpCircle className="w-5 h-5" />
          <span>How to Play</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center space-x-3">
            <Trophy className="w-6 h-6 text-yellow-500" />
            <span>How to Play Competitive Yahtzee</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-slate-300">
          {/* Platform Overview */}
          <Card className="bg-gradient-to-br from-violet-500/20 to-purple-600/20 border-violet-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Star className="w-5 h-5 text-violet-400" />
                <span>Platform Overview</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>Compete & Earn Real Money is a competitive gaming platform where you can play Yahtzee for real money. Join tables with entry fees ranging from $0.50 to $50.00 and compete against other players to win prize pools!</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  <span>Entry fees: $0.50 - $50.00</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>2-5 players per table</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span>Time limits: 5-20 minutes</span>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Win 95% of prize pool</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Game Rules */}
          <Card className="bg-slate-800/50 border-slate-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Dice3 className="w-5 h-5 text-green-400" />
                <span>Yahtzee Game Rules</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-white mb-2">Basic Gameplay:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• Each player takes turns rolling 5 dice</li>
                  <li>• You get up to 3 rolls per turn</li>
                  <li>• After each roll, you can hold any dice you want to keep</li>
                  <li>• Score in one of 13 categories each turn</li>
                  <li>• Game ends when all players have filled all 13 categories</li>
                  <li>• <strong>Highest total score wins the entire prize pool!</strong></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-white mb-2">Turn Structure:</h4>
                <ol className="space-y-1 ml-4">
                  <li>1. Roll all 5 dice (or continue with held dice)</li>
                  <li>2. Choose which dice to hold (click to toggle)</li>
                  <li>3. Roll again (up to 3 total rolls)</li>
                  <li>4. Select a scoring category to complete your turn</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Scoring Categories */}
          <Card className="bg-slate-800/50 border-slate-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-blue-400" />
                <span>Scoring Categories</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upper Section */}
              <div>
                <h4 className="font-semibold text-white mb-3 flex items-center space-x-2">
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">Upper Section</Badge>
                  <span className="text-sm text-slate-400">(Bonus: +35 points if total ≥ 63)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                    <div className="flex items-center space-x-2">
                      <Dice1 className="w-4 h-4" />
                      <span>Ones</span>
                    </div>
                    <span className="text-slate-400">Count all 1s</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                    <div className="flex items-center space-x-2">
                      <Dice2 className="w-4 h-4" />
                      <span>Twos</span>
                    </div>
                    <span className="text-slate-400">Count all 2s</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                    <div className="flex items-center space-x-2">
                      <Dice3 className="w-4 h-4" />
                      <span>Threes</span>
                    </div>
                    <span className="text-slate-400">Count all 3s</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                    <div className="flex items-center space-x-2">
                      <Dice4 className="w-4 h-4" />
                      <span>Fours</span>
                    </div>
                    <span className="text-slate-400">Count all 4s</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                    <div className="flex items-center space-x-2">
                      <Dice5 className="w-4 h-4" />
                      <span>Fives</span>
                    </div>
                    <span className="text-slate-400">Count all 5s</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                    <div className="flex items-center space-x-2">
                      <Dice6 className="w-4 h-4" />
                      <span>Sixes</span>
                    </div>
                    <span className="text-slate-400">Count all 6s</span>
                  </div>
                </div>
              </div>

              <Separator className="bg-slate-600" />

              {/* Lower Section */}
              <div>
                <h4 className="font-semibold text-white mb-3 flex items-center space-x-2">
                  <Badge variant="secondary" className="bg-green-500/20 text-green-300">Lower Section</Badge>
                  <span className="text-sm text-slate-400">(Higher point values)</span>
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded">
                    <div>
                      <div className="font-medium">3 of a Kind</div>
                      <div className="text-sm text-slate-400">At least 3 dice showing same number</div>
                    </div>
                    <Badge className="bg-green-600">Sum of all dice</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded">
                    <div>
                      <div className="font-medium">4 of a Kind</div>
                      <div className="text-sm text-slate-400">At least 4 dice showing same number</div>
                    </div>
                    <Badge className="bg-green-600">Sum of all dice</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded">
                    <div>
                      <div className="font-medium">Full House</div>
                      <div className="text-sm text-slate-400">3 of one number + 2 of another</div>
                    </div>
                    <Badge className="bg-yellow-600">25 points</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded">
                    <div>
                      <div className="font-medium">Small Straight</div>
                      <div className="text-sm text-slate-400">4 consecutive numbers (1-2-3-4, 2-3-4-5, or 3-4-5-6)</div>
                    </div>
                    <Badge className="bg-blue-600">30 points</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded">
                    <div>
                      <div className="font-medium">Large Straight</div>
                      <div className="text-sm text-slate-400">5 consecutive numbers (1-2-3-4-5 or 2-3-4-5-6)</div>
                    </div>
                    <Badge className="bg-purple-600">40 points</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded">
                    <div>
                      <div className="font-medium">YAHTZEE</div>
                      <div className="text-sm text-slate-400">All 5 dice showing same number</div>
                    </div>
                    <Badge className="bg-red-600">50 points</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded">
                    <div>
                      <div className="font-medium">Chance</div>
                      <div className="text-sm text-slate-400">Any combination - use as backup</div>
                    </div>
                    <Badge className="bg-gray-600">Sum of all dice</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Platform Mechanics */}
          <Card className="bg-gradient-to-br from-emerald-500/20 to-green-600/20 border-emerald-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span>Platform & Money Mechanics</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-white mb-2">How Tables Work:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Create or Join:</strong> Browse available tables or create your own</li>
                  <li>• <strong>Entry Fee:</strong> Each player pays the same entry fee ($0.50 - $50.00)</li>
                  <li>• <strong>Prize Pool:</strong> 95% of total entry fees (5% platform fee)</li>
                  <li>• <strong>Winner Takes All:</strong> Highest score wins the entire prize pool</li>
                  <li>• <strong>Time Limit:</strong> Complete your game within the set time limit</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Example Prize Calculation:</h4>
                <div className="bg-slate-700/30 p-3 rounded">
                  <p>4 players × $5.00 entry fee = $20.00 total</p>
                  <p>Prize pool: $19.00 (95% of $20.00)</p>
                  <p>Platform fee: $1.00 (5% of $20.00)</p>
                  <p><strong className="text-emerald-400">Winner receives: $19.00</strong></p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Adding Funds & Withdrawals:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• Add funds using secure payment methods</li>
                  <li>• Withdraw winnings to your connected account</li>
                  <li>• All transactions are secure and encrypted</li>
                  <li>• View complete transaction history</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Strategy Tips */}
          <Card className="bg-slate-800/50 border-slate-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-orange-400" />
                <span>Strategy Tips</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold text-white mb-2">Upper Section Strategy:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• Aim for 63+ points to get the 35-point bonus</li>
                  <li>• Try to get at least 3 of each number (3×1=3, 3×2=6, etc.)</li>
                  <li>• Focus on 4s, 5s, and 6s for higher scores</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-white mb-2">Lower Section Strategy:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• Save "Chance" as a backup for bad rolls</li>
                  <li>• Go for Yahtzee when you have 3+ of the same number</li>
                  <li>• Look for straights when you have consecutive numbers</li>
                  <li>• Full House is easier than it seems - look for pairs</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">General Tips:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Time Management:</strong> Don't overthink - you have a time limit</li>
                  <li>• <strong>Risk vs Reward:</strong> Sometimes take a zero to save better categories</li>
                  <li>• <strong>Dice Holding:</strong> Hold dice strategically between rolls</li>
                  <li>• <strong>Score Tracking:</strong> Watch opponents' scores to gauge your position</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Important Notes */}
          <Card className="bg-gradient-to-br from-red-500/20 to-pink-600/20 border-red-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Shield className="w-5 h-5 text-red-400" />
                <span>Important Notes & Rules</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-white mb-2">Game Rules:</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• Once you score a category, it cannot be changed</li>
                    <li>• You must score in exactly one category per turn</li>
                    <li>• If time runs out, you forfeit the game</li>
                    <li>• Leaving mid-game results in automatic loss</li>
                    <li>• All dice rolls are cryptographically secure</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-white mb-2">Platform Rules:</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• You must be 18+ to play for money</li>
                    <li>• Play responsibly and within your limits</li>
                    <li>• One account per person</li>
                    <li>• No collusion or cheating allowed</li>
                    <li>• Platform decisions are final</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 mt-4">
                <p className="text-yellow-200 font-medium">
                  ⚠️ <strong>Responsible Gaming:</strong> Only play with money you can afford to lose. Set limits for yourself and stick to them. If you need help with gambling issues, please seek professional assistance.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Getting Started */}
          <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-blue-400" />
                <span>Ready to Start?</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-3">
                <p>Now that you understand the rules, you're ready to compete!</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    <span>Browse or create a table</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    <span>Pay entry fee to join</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                    <span>Play and win!</span>
                  </div>
                </div>
                <p className="text-slate-400 text-sm mt-4">
                  Good luck and may the highest score win! 🎲
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}