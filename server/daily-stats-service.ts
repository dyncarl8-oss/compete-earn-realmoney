import { storage } from './storage';
import type { DailyStatsData } from './gemini-service';
import { logger } from './logger';

export async function getDailyStats(hoursBack: number = 12): Promise<DailyStatsData> {
  try {
    const now = new Date();
    const startTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    const allUsers = await storage.getAllUsers();
    const allTransactions = await storage.getAllTransactions();
    const allGames = await storage.getAvailableGames();

    const newUsers = allUsers.filter(u => {
      const createdAt = u.createdAt ? new Date(u.createdAt) : null;
      return createdAt && createdAt >= startTime;
    });

    const recentTransactions = allTransactions.filter(t => {
      const createdAt = t.createdAt ? new Date(t.createdAt) : null;
      return createdAt && createdAt >= startTime;
    });

    const activeUserIds = new Set(recentTransactions.map(t => t.userId));
    const activeUsers = activeUserIds.size;

    const bonusTransactions = recentTransactions.filter(t => 
      t.description.includes('Welcome Bonus')
    );
    const bonusClaimers = bonusTransactions.length;

    const entryTransactions = recentTransactions.filter(t => t.type === 'entry');
    const totalGamesPlayed = entryTransactions.length;

    const yahtzeeGames = recentTransactions.filter(t => 
      t.description.toLowerCase().includes('yahtzee') || 
      (t.gameId && t.description.includes('entry'))
    ).length;

    const chessGames = recentTransactions.filter(t => 
      t.description.toLowerCase().includes('chess')
    ).length;

    const plinkoTransactions = recentTransactions.filter(t => t.type === 'plinko');
    const plinkoGames = plinkoTransactions.length;

    const diceTransactions = recentTransactions.filter(t => t.type === 'dice');
    const diceGames = diceTransactions.length;

    const deposits = recentTransactions
      .filter(t => t.type === 'deposit' && !t.description.includes('Welcome Bonus'))
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const withdrawals = recentTransactions
      .filter(t => t.type === 'withdrawal')
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

    const totalWinnings = recentTransactions
      .filter(t => t.type === 'win')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const platformCommission = recentTransactions
      .filter(t => t.type === 'commission')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const winTransactions = recentTransactions.filter(t => t.type === 'win');
    const topWinnersMap = new Map<string, { username: string; amount: number; gameType: string }>();

    for (const tx of winTransactions) {
      const user = await storage.getUser(tx.userId);
      if (user) {
        const existing = topWinnersMap.get(tx.userId);
        const amount = parseFloat(tx.amount);
        const gameType = tx.description.toLowerCase().includes('yahtzee') ? 'Yahtzee' :
                         tx.description.toLowerCase().includes('chess') ? 'Chess' :
                         tx.description.toLowerCase().includes('plinko') ? 'Plinko' :
                         tx.description.toLowerCase().includes('dice') ? 'Dice' : 'Game';
        
        if (!existing || amount > existing.amount) {
          topWinnersMap.set(tx.userId, {
            username: user.username,
            amount,
            gameType
          });
        }
      }
    }

    const topWinners = Array.from(topWinnersMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const signupToPlayRate = newUsers.length > 0 
      ? (newUsers.filter(u => activeUserIds.has(u.id)).length / newUsers.length) * 100 
      : 0;

    const averageGamesPerActiveUser = activeUsers > 0 
      ? totalGamesPlayed / activeUsers 
      : 0;

    const bonusConversionRate = bonusClaimers > 0 
      ? (bonusTransactions.filter(t => activeUserIds.has(t.userId)).length / bonusClaimers) * 100 
      : 0;

    const period = hoursBack === 12 ? 'Last 12 Hours' : 'Last 24 Hours';

    const userBalances = allUsers
      .map(u => ({
        username: u.username,
        balance: u.balance,
        gamesPlayed: u.gamesPlayed || 0,
        totalWinnings: u.totalWinnings || '0.00'
      }))
      .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));

    // Get page view statistics
    const totalPageViews = await storage.getPageViewCount(undefined, hoursBack);
    const gameLobbyPageViews = await storage.getPageViewCount('/', hoursBack);

    return {
      period,
      newUsers: newUsers.length,
      activeUsers,
      totalUsers: allUsers.length,
      bonusClaimers,
      totalGamesPlayed,
      gameBreakdown: {
        yahtzee: yahtzeeGames,
        chess: chessGames,
        plinko: plinkoGames,
        dice: diceGames,
      },
      financials: {
        deposits,
        withdrawals,
        totalWinnings,
        platformCommission,
      },
      topWinners,
      engagement: {
        signupToPlayRate,
        averageGamesPerActiveUser,
        bonusConversionRate,
      },
      pageViews: {
        totalViews: totalPageViews,
        gameLobbyViews: gameLobbyPageViews,
      },
      userBalances,
    };
  } catch (error) {
    logger.error('❌ Failed to gather daily stats:', error);
    throw error;
  }
}
