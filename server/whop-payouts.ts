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

export async function payAdminCommission(options: PayoutOptions): Promise<boolean> {
  try {
    console.log(`💰 Attempting to pay admin commission ${options.userId} $${options.amount} for game ${options.gameId}`);
    
    // Get current user to update their app currency balance
    const user = await storage.getUser(options.userId);
    if (!user) {
      console.error(`❌ Admin ${options.userId} not found for commission payout!`);
      return false;
    }

    console.log(`Current balance for admin ${options.userId}: $${user.balance}`);

    // Use precise decimal arithmetic
    const currentBalance = new MoneyAmount(user.balance);
    const commissionAmount = new MoneyAmount(options.amount.toString());
    const newBalance = currentBalance.add(commissionAmount);
    
    console.log(`Calculated new balance: $${newBalance.toString()} (${user.balance} + ${commissionAmount.toString()})`);
    
    // Update admin balance
    await storage.updateUserBalance(options.userId, newBalance.toString());
    console.log(`✅ Updated admin ${options.userId} balance to $${newBalance.toString()}`);
    
    // Create commission transaction
    await storage.createTransaction({
      userId: options.userId,
      type: "commission",
      amount: commissionAmount.toString(),
      description: options.description,
      gameId: options.gameId,
      balanceAfter: newBalance.toString(),
    });
    console.log(`✅ Created admin commission transaction for ${options.userId}`);
    
    console.log(`✅ Successfully paid $${options.amount} admin commission to ${options.userId}. New balance: $${newBalance.toString()}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to pay admin commission:`, error);
    console.error(`Details - userId: ${options.userId}, amount: ${options.amount}, gameId: ${options.gameId}`);
    return false;
  }
}

export async function processCommission(amount: number, gameId: string): Promise<boolean> {
  try {
    console.log(`💵 Processing platform commission of $${amount} for game ${gameId}`);
    
    // Get the game to find the tournament
    const game = await storage.getGame(gameId);
    if (!game || !game.tournamentId) {
      console.log(`⚠️ Game ${gameId} has no tournament - skipping admin commission`);
      return true;
    }
    
    // Get the tournament to find the admin who hosted it
    const tournament = await storage.getTournament(game.tournamentId);
    if (!tournament) {
      console.error(`❌ Tournament ${game.tournamentId} not found for game ${gameId}`);
      return false;
    }
    
    // Pay commission to the admin who hosted the tournament
    const adminId = tournament.hostedBy;
    const commissionPaid = await payAdminCommission({
      userId: adminId,
      amount,
      description: `${game.name} - Tournament Commission`,
      gameId,
    });
    
    if (commissionPaid) {
      console.log(`✅ Successfully paid $${amount} commission to admin ${adminId} for tournament ${tournament.name}`);
    } else {
      console.error(`❌ Failed to pay commission to admin ${adminId}`);
    }
    
    return commissionPaid;
  } catch (error) {
    console.error("Failed to process platform commission:", error);
    return false;
  }
}