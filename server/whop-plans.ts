import { whopSdk } from "./whop-sdk";

// Whop plan configurations for different game entry fees
export const WHOP_PLANS = {
  "game-entry-1": {
    planId: "plan_game_entry_1_dollar",
    price: 100, // $1.00 in cents
    name: "Game Entry - $1",
    description: "Entry fee for $1 games",
  },
  "game-entry-2": {
    planId: "plan_game_entry_2_dollar", 
    price: 200, // $2.00 in cents
    name: "Game Entry - $2",
    description: "Entry fee for $2 games",
  },
  "game-entry-5": {
    planId: "plan_game_entry_5_dollar",
    price: 500, // $5.00 in cents
    name: "Game Entry - $5", 
    description: "Entry fee for $5 games",
  },
  "game-entry-10": {
    planId: "plan_game_entry_10_dollar",
    price: 1000, // $10.00 in cents
    name: "Game Entry - $10",
    description: "Entry fee for $10 games",
  },
};

export async function createWhopPlan(entryFee: string): Promise<string | null> {
  try {
    const amount = parseFloat(entryFee);
    const planKey = `game-entry-${Math.floor(amount)}`;
    
    // Check if plan already exists
    if (WHOP_PLANS[planKey as keyof typeof WHOP_PLANS]) {
      return WHOP_PLANS[planKey as keyof typeof WHOP_PLANS].planId;
    }

    // Create new plan via Whop API
    const plan = await whopSdk.createPlan({
      price: Math.round(amount * 100), // Convert to cents
      name: `Game Entry - $${amount}`,
      description: `Entry fee for $${amount} games`,
      currency: "USD",
      interval: "one_time",
      metadata: {
        type: "game_entry",
        amount: entryFee,
      },
    });

    return plan.id;
  } catch (error) {
    console.error("Failed to create Whop plan:", error);
    return null;
  }
}

export function getPlanForGameEntry(entryFee: string): string {
  const amount = parseFloat(entryFee);
  const planKey = `game-entry-${Math.floor(amount)}`;
  
  return WHOP_PLANS[planKey as keyof typeof WHOP_PLANS]?.planId || "plan_default_game_entry";
}