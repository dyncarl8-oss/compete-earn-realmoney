import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from './logger';

const GEMINI_API_KEY = process.env.GEMINI_KEY;

if (!GEMINI_API_KEY) {
  logger.warn('⚠️ GEMINI_KEY not set in environment - AI summaries will fail. Add GEMINI_KEY to Secrets.');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export interface DailyStatsData {
  period: string;
  newUsers: number;
  activeUsers: number;
  totalUsers: number;
  bonusClaimers: number;
  totalGamesPlayed: number;
  gameBreakdown: {
    yahtzee: number;
    chess: number;
    plinko: number;
    dice: number;
  };
  financials: {
    deposits: number;
    withdrawals: number;
    totalWinnings: number;
    platformCommission: number;
  };
  topWinners: Array<{
    username: string;
    amount: number;
    gameType: string;
  }>;
  engagement: {
    signupToPlayRate: number;
    averageGamesPerActiveUser: number;
    bonusConversionRate: number;
  };
  pageViews: {
    totalViews: number;
    gameLobbyViews: number;
  };
  userBalances: Array<{
    username: string;
    balance: string;
    gamesPlayed: number;
    totalWinnings: string;
  }>;
}

export async function generateAISummary(stats: DailyStatsData): Promise<string> {
  try {
    if (!genAI) {
      throw new Error('Gemini AI not initialized - GEMINI_KEY missing');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `You are an AI assistant helping a gaming platform owner understand their app's daily performance. 

Analyze the following data and write a SHORT summary (2-3 sentences max) that highlights:
- The most important metric or trend
- One actionable insight if needed

Be direct and skip unnecessary details. Focus only on what matters most.

DATA:
${JSON.stringify(stats, null, 2)}

Write a brief, straight-to-the-point summary:`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const summary = response.text();

    logger.info('✅ AI summary generated successfully');
    return summary;
  } catch (error) {
    logger.error('❌ Failed to generate AI summary:', error);
    throw error;
  }
}
