// RATE LIMITER GLOBAL PARA BASE44
// Usar em TODAS as functions para evitar 429

let lastBase44CallAt = 0;
const MIN_INTERVAL_MS = 600;

export async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function base44RateLimit() {
  const now = Date.now();
  const elapsed = now - lastBase44CallAt;
  if (elapsed < MIN_INTERVAL_MS) {
    const wait = MIN_INTERVAL_MS - elapsed;
    await sleep(wait);
  }
  lastBase44CallAt = Date.now();
}

export async function base44CallWithRetry(fn, maxRetries = 10) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await base44RateLimit();
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.status || err?.response?.status;
      const msg = String(err?.message || '').toLowerCase();
      
      const is429 = status === 429 || msg.includes('rate limit');
      const is5xx = status === 502 || status === 503 || status === 504;
      const isConn = msg.includes('connection') || msg.includes('timeout') || msg.includes('socket') || msg.includes('network') || msg.includes('fetch failed');
      
      const isRetryable = is429 || is5xx || isConn;
      if (!isRetryable || attempt === maxRetries) throw err;
      
      const backoff = is429
        ? Math.min(30000, 2000 * Math.pow(2, attempt) + Math.random() * 1000)
        : Math.min(20000, 1000 * Math.pow(2, attempt) + Math.random() * 500);
      
      console.log(`[RETRY] ${is429 ? '429' : status || 'ERR'} #${attempt + 1}/${maxRetries + 1} wait ${Math.round(backoff)}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}