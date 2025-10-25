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
    console.log(`💰 Attempting to pay winner ${options.userId} $${options.amount} for game ${options.gameId}`);
    
    // Get current user to update their app currency balance
    const user = await storage.getUser(options.userId);
    if (!user) {
      console.error(`❌ User ${options.userId} not found for payout - cannot pay winner!`);
      return false;
    }

    console.log(`Current balance for user ${options.userId}: $${user.balance}`);

    // Use precise decimal arithmetic
    const currentBalance = new MoneyAmount(user.balance);
    const prizeAmount = new MoneyAmount(options.amount.toString());
    const newBalance = currentBalance.add(prizeAmount);
    
    console.log(`Calculated new balance: $${newBalance.toString()} (${user.balance} + ${prizeAmount.toString()})`);
    
    // Update user balance
    await storage.updateUserBalance(options.userId, newBalance.toString());
    console.log(`✅ Updated user ${options.userId} balance to $${newBalance.toString()}`);
    
    // Create the win transaction that withdrawal validation depends on
    await storage.createTransaction({
      userId: options.userId,
      type: "win",
      amount: prizeAmount.toString(),
      description: options.description,
      gameId: options.gameId,
      balanceAfter: newBalance.toString(),
    });
    console.log(`✅ Created win transaction for user ${options.userId}`);
    
    console.log(`✅ Successfully paid $${options.amount} to user ${options.userId}. New balance: $${newBalance.toString()}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to pay winner with app currency:`, error);
    console.error(`Details - userId: ${options.userId}, amount: ${options.amount}, gameId: ${options.gameId}`);
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