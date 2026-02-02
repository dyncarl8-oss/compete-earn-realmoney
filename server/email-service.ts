import { Resend } from 'resend';
import { logger } from './logger';
import type { DailyStatsData } from './gemini-service';

interface WithdrawalNotification {
  userName: string;
  userId: string;
  amount: string;
  userEmail?: string;
  transactionId: string;
  timestamp: string;
}

interface DepositNotification {
  userName: string;
  userId: string;
  amount: string;
  userEmail?: string;
  transactionId: string;
  timestamp: string;
}

interface PaymentAttemptNotification {
  userName: string;
  userId: string;
  amount: string;
  userEmail?: string;
  timestamp: string;
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'princederder44@gmail.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  logger.warn('⚠️ RESEND_API_KEY not set in environment - email notifications will fail. Set RESEND_API_KEY in Secrets for production.');
}

const resend = new Resend(RESEND_API_KEY);

export async function sendWithdrawalNotification(details: WithdrawalNotification): Promise<boolean> {
  try {
    const emailContent = `
New Withdrawal Request Received
================================

User Details:
- Name: ${details.userName}
- User ID: ${details.userId}
${details.userEmail ? `- Email: ${details.userEmail}` : ''}

Withdrawal Details:
- Amount: $${details.amount}
- Transaction ID: ${details.transactionId}
- Timestamp: ${details.timestamp}

Action Required:
Please process this withdrawal manually and pay the user the requested amount.

---
This is an automated notification from your Compete & Earn Real Money application.
    `.trim();

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `💰 Withdrawal Request: $${details.amount} - ${details.userName}`,
      text: emailContent,
    });

    if (error) {
      logger.error('❌ Failed to send withdrawal notification email:', error);
      return false;
    }

    logger.info(`✅ Withdrawal notification email sent successfully:`, data?.id);
    return true;
  } catch (error) {
    logger.error('❌ Failed to send withdrawal notification email:', error);
    return false;
  }
}

export async function sendDepositNotification(details: DepositNotification): Promise<boolean> {
  try {
    const emailContent = `
New Deposit Received
====================

User Details:
- Name: ${details.userName}
- User ID: ${details.userId}
${details.userEmail ? `- Email: ${details.userEmail}` : ''}

Deposit Details:
- Amount: $${details.amount}
- Transaction ID: ${details.transactionId}
- Timestamp: ${details.timestamp}

A player has successfully added funds to their account.

---
This is an automated notification from your Compete & Earn Real Money application.
    `.trim();

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `💵 Deposit Received: $${details.amount} - ${details.userName}`,
      text: emailContent,
    });

    if (error) {
      logger.error('❌ Failed to send deposit notification email:', error);
      return false;
    }

    logger.info(`✅ Deposit notification email sent successfully:`, data?.id);
    return true;
  } catch (error) {
    logger.error('❌ Failed to send deposit notification email:', error);
    return false;
  }
}

export async function sendPaymentAttemptNotification(details: PaymentAttemptNotification): Promise<boolean> {
  try {
    const emailContent = `
Payment Attempt Detected
========================

User Details:
- Name: ${details.userName}
- User ID: ${details.userId}
${details.userEmail ? `- Email: ${details.userEmail}` : ''}

Payment Attempt:
- Amount: $${details.amount}
- Timestamp: ${details.timestamp}

Status: Payment modal opened - User is viewing payment screen
(You will receive another notification if payment is completed successfully)

---
This is an automated notification from your Compete & Earn Real Money application.
    `.trim();

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `🔔 Payment Attempt: $${details.amount} - ${details.userName}`,
      text: emailContent,
    });

    if (error) {
      logger.error('❌ Failed to send payment attempt notification email:', error);
      return false;
    }

    logger.info(`✅ Payment attempt notification email sent successfully:`, data?.id);
    return true;
  } catch (error) {
    logger.error('❌ Failed to send payment attempt notification email:', error);
    return false;
  }
}

export async function sendDailySummary(stats: DailyStatsData): Promise<boolean> {
  try {
    const userBalanceTable = stats.userBalances.length > 0
      ? stats.userBalances.map((u, i) => 
          `${(i + 1).toString().padEnd(4)} ${u.username.padEnd(20)} $${u.balance.padEnd(10)} ${u.gamesPlayed.toString().padEnd(8)} $${u.totalWinnings}`
        ).join('\n')
      : 'No users';

    const emailContent = `
Compete & Earn Real Money Daily Report - ${stats.period}
${'='.repeat(70)}

👥 ALL USER BALANCES (${stats.userBalances.length} users)
${'='.repeat(70)}
#    Username             Balance      Games    Winnings
${'—'.repeat(70)}
${userBalanceTable}

${'='.repeat(70)}

📊 PERIOD SUMMARY
${'='.repeat(70)}
New Users: ${stats.newUsers}
Active Users: ${stats.activeUsers}
Total Games: ${stats.totalGamesPlayed}
Welcome Bonus Claims: ${stats.bonusClaimers}

🎮 GAMES PLAYED
${'—'.repeat(70)}
Yahtzee: ${stats.gameBreakdown.yahtzee}
Chess: ${stats.gameBreakdown.chess}
Plinko: ${stats.gameBreakdown.plinko}
Dice: ${stats.gameBreakdown.dice}

💰 FINANCIALS
${'—'.repeat(70)}
Deposits: $${stats.financials.deposits.toFixed(2)}
Withdrawals: $${stats.financials.withdrawals.toFixed(2)}
Total Winnings Paid: $${stats.financials.totalWinnings.toFixed(2)}
Platform Commission: $${stats.financials.platformCommission.toFixed(2)}

🏆 TOP WINNERS (This Period)
${'—'.repeat(70)}
${stats.topWinners.length > 0 
  ? stats.topWinners.map((w, i) => `${i + 1}. ${w.username} - $${w.amount.toFixed(2)} (${w.gameType})`).join('\n')
  : 'No winners in this period'}

📈 ENGAGEMENT
${'—'.repeat(70)}
Signup to Play Rate: ${stats.engagement.signupToPlayRate.toFixed(1)}%
Avg Games per Active User: ${stats.engagement.averageGamesPerActiveUser.toFixed(1)}
Bonus Conversion Rate: ${stats.engagement.bonusConversionRate.toFixed(1)}%

👁️ PAGE VIEWS
${'—'.repeat(70)}
Total Website Visits: ${stats.pageViews.totalViews}
Game Lobby Page Visits: ${stats.pageViews.gameLobbyViews}

${'='.repeat(70)}
Generated: ${new Date().toLocaleString()}
    `.trim();

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `📊 Compete & Earn Real Money ${stats.period} Report - ${stats.totalGamesPlayed} Games, ${stats.newUsers} New Users`,
      text: emailContent,
    });

    if (error) {
      logger.error('❌ Failed to send daily summary email:', error);
      return false;
    }

    logger.info(`✅ Daily summary email sent successfully:`, data?.id);
    return true;
  } catch (error) {
    logger.error('❌ Failed to send daily summary email:', error);
    return false;
  }
}
