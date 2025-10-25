import { useState } from "react";
import { useParams } from "wouter";
import { useDashboardUser, useDashboardLedgerAccount, useDashboardTransfer } from "@/hooks/use-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Search, Send, Wallet, User } from "lucide-react";

export default function Dashboard() {
  const { companyId } = useParams();
  const [userId, setUserId] = useState("");
  const [searchedUserId, setSearchedUserId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { data: userData, isLoading: userLoading, error: userError } = useDashboardUser(searchedUserId);
  const { data: ledgerData, isLoading: ledgerLoading } = useDashboardLedgerAccount(companyId || null);
  const transferMutation = useDashboardTransfer();

  const handleSearch = () => {
    if (userId.trim()) {
      setSearchedUserId(userId.trim());
    }
  };

  const handleTransfer = async () => {
    if (!userData || !ledgerData?.company?.ledgerAccount) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    await transferMutation.mutateAsync({
      amount: numAmount,
      currency: "usd",
      destinationId: userData.id,
      ledgerAccountId: ledgerData.company.ledgerAccount.id,
      transferFee: ledgerData.company.ledgerAccount.transfer_fee || undefined,
      notes: notes || undefined,
    });

    // Reset form after successful transfer
    setAmount("");
    setNotes("");
  };

  const ledgerAccount = ledgerData?.company?.ledgerAccount;
  const usdBalance = ledgerAccount?.balances?.find(b => b.currency === "usd");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Payment Dashboard</h1>
          <p className="text-gray-400">Manage user payments and transfers</p>
        </div>

        {/* Ledger Account Info */}
        {ledgerLoading ? (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </CardContent>
          </Card>
        ) : ledgerAccount ? (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Your Ledger Account
              </CardTitle>
              <CardDescription className="text-gray-400">
                Current balance and account information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">Available Balance</p>
                  <p className="text-2xl font-bold text-green-400">
                    ${usdBalance?.balance?.toFixed(2) || "0.00"}
                  </p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">Pending Balance</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    ${usdBalance?.pending_balance?.toFixed(2) || "0.00"}
                  </p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">Transfer Fee</p>
                  <p className="text-2xl font-bold text-gray-300">
                    {ledgerAccount.transfer_fee ? `${(ledgerAccount.transfer_fee * 100).toFixed(1)}%` : "None"}
                  </p>
                </div>
              </div>
              <div className="text-sm text-gray-400">
                <p>Ledger ID: <span className="text-gray-300 font-mono">{ledgerAccount.id}</span></p>
                <p>Status: <span className="text-green-400">{ledgerAccount.payments_approval_status}</span></p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Alert className="bg-red-900/20 border-red-800">
            <AlertDescription className="text-red-400">
              Unable to load ledger account information
            </AlertDescription>
          </Alert>
        )}

        {/* User Search */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Search className="h-5 w-5" />
              Find User
            </CardTitle>
            <CardDescription className="text-gray-400">
              Enter a Whop user ID to look up user information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="user_xxxxxxxxxxxxx"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button 
                onClick={handleSearch}
                disabled={!userId.trim() || userLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {userLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {userError && (
              <Alert className="bg-red-900/20 border-red-800">
                <AlertDescription className="text-red-400">
                  User not found or error retrieving user data
                </AlertDescription>
              </Alert>
            )}

            {userData && (
              <div className="bg-gray-700 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  {userData.profile_picture?.url ? (
                    <img 
                      src={userData.profile_picture.url} 
                      alt={userData.username}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
                      <User className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-white font-semibold">@{userData.username}</p>
                    {userData.name && <p className="text-gray-400 text-sm">{userData.name}</p>}
                  </div>
                </div>
                <div className="text-sm text-gray-400 space-y-1">
                  <p>User ID: <span className="text-gray-300 font-mono">{userData.id}</span></p>
                  <p>Member since: <span className="text-gray-300">{new Date(userData.created_at).toLocaleDateString()}</span></p>
                  {userData.bio && <p className="text-gray-300 italic">"{userData.bio}"</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Form */}
        {userData && ledgerAccount && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Payment
              </CardTitle>
              <CardDescription className="text-gray-400">
                Transfer funds to @{userData.username}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-gray-300">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-gray-300">Notes (Optional)</Label>
                <Input
                  id="notes"
                  type="text"
                  placeholder="Payment description"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={50}
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                />
                <p className="text-xs text-gray-500">Maximum 50 characters</p>
              </div>

              <Button
                onClick={handleTransfer}
                disabled={!amount || transferMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {transferMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Transfer...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send ${amount || "0.00"} to @{userData.username}
                  </>
                )}
              </Button>

              {ledgerAccount.transfer_fee && amount && (
                <Alert className="bg-blue-900/20 border-blue-800">
                  <AlertDescription className="text-blue-400 text-sm">
                    Transfer fee: ${(parseFloat(amount || "0") * ledgerAccount.transfer_fee).toFixed(2)} 
                    ({(ledgerAccount.transfer_fee * 100).toFixed(1)}%)
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
