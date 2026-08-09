const logger = {
  info: (...args) => console.log(`[${new Date().toISOString()}] ℹ️ `, ...args),
  error: (...args) => console.error(`[${new Date().toISOString()}] ❌ `, ...args),
  warn: (...args) => console.warn(`[${new Date().toISOString()}] ⚠️ `, ...args),
  success: (...args) => console.log(`[${new Date().toISOString()}] ✅ `, ...args),
};

export default logger;
