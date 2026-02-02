import cron from 'node-cron';
import { getDailyStats } from './daily-stats-service';
import { sendDailySummary } from './email-service';
import { logger } from './logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export function startReportScheduler() {
  if (!RESEND_API_KEY) {
    logger.warn('⚠️ Report scheduler disabled: RESEND_API_KEY not set. Add RESEND_API_KEY secret to enable daily email reports.');
    return;
  }

  logger.info('🕒 Starting daily report scheduler...');

  cron.schedule('0 8,20 * * *', async () => {
    try {
      logger.info('📊 Starting scheduled daily report generation...');
      await generateAndSendReport();
    } catch (error) {
      logger.error('❌ Scheduled report generation failed:', error);
    }
  }, {
    timezone: 'America/New_York'
  });

  logger.info('✅ Report scheduler initialized - Reports will be sent at 8 AM and 8 PM EST');
}

export async function generateAndSendReport() {
  logger.info('📊 Gathering daily statistics...');
  const stats = await getDailyStats(12);

  logger.info('📧 Sending daily summary email...');
  const emailSent = await sendDailySummary(stats);

  if (emailSent) {
    logger.info('✅ Daily report successfully generated and sent!');
  } else {
    throw new Error('Failed to send daily report email');
  }
}
