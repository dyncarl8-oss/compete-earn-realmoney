const DEBUG = process.env.DEBUG === 'true';

export const logger = {
  debug: (message: string, data?: any) => {
    if (DEBUG) {
      if (data) {
        console.log(`🔍 DEBUG: ${message}`, data);
      } else {
        console.log(`🔍 DEBUG: ${message}`);
      }
    }
  },
  
  info: (message: string, data?: any) => {
    if (data) {
      console.log(`ℹ️ INFO: ${message}`, data);
    } else {
      console.log(`ℹ️ INFO: ${message}`);
    }
  },
  
  warn: (message: string, data?: any) => {
    if (data) {
      console.warn(`⚠️ WARN: ${message}`, data);
    } else {
      console.warn(`⚠️ WARN: ${message}`);
    }
  },
  
  error: (message: string, error?: any) => {
    if (error) {
      console.error(`❌ ERROR: ${message}`, error);
    } else {
      console.error(`❌ ERROR: ${message}`);
    }
  }
};