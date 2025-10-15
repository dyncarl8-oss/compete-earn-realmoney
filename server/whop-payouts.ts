import { storage } from "./storage";
import { MoneyAmount } from "./decimal-utils";

interface PayoutOptions {
  userId: string;
  amount: number;
  description: string;
  gameId: string;
}

export async function payWinner(options: PayoutOptions): Promise<boolean> {
  try {
    // Get current user to update their app currency balance
    const user = await storage.getUser(options.userId);
    if (!user) {
      console.error(`User ${options.userId} not found for payout`);
      return false;
    }

    // Use precise decimal arithmetic
    const currentBalance = new MoneyAmount(user.balance);
    const prizeAmount = new MoneyAmount(options.amount.toString());
    const newBalance = currentBalance.add(prizeAmount);
    
    // Update user balance
    await storage.updateUserBalance(options.userId, newBalance.toString());
    
    // CRITICAL FIX: Create the win transaction that withdrawal validation depends on
    await storage.createTransaction({
      userId: options.userId,
      type: "win",
      amount: prizeAmount.toString(),
      description: options.description,
      gameId: options.gameId,
      balanceAfter: newBalance.toString(),
    });
    
    console.log(`Added $${options.amount} app currency to user ${options.userId}'s balance (game ${options.gameId}). New balance: $${newBalance.toString()}`);
    return true;
  } catch (error) {
    console.error("Failed to pay winner with app currency:", error);
    return false;
  }
}

export async function processCommission(amount: number, gameId: string): Promise<boolean> {
  try {
    // Record commission for the app creator
    // In a real Whop app, this would be automatically handled by Whop's commission system
    console.log(`Commission of $${amount} recorded for game ${gameId}`);
    return true;
  } catch (error) {
    console.error("Failed to process commission:", error);
    return false;
  }
}