/**
 * Helper padronizado para chamadas à API da Nuvemshop
 * Usa apenas X-Access-Token (não Authentication/Authorization)
 */

export function sanitizeToken(token) {
  return String(token || '').trim();
}

export function getNuvemshopHeaders(token) {
  const sanitized = sanitizeToken(token);
  return {
    'Authentication': `bearer ${sanitized}`,
    'User-Agent': 'Baseflow (contato@baseflow.com.br)',
    'Accept': 'application/json'
  };
}

export async function fetchWithRetry(url, options = {}, opts = {}) {
  const maxRetries = opts.maxRetries || 8;
  const headers = options.headers || {};
  const method = options.method || 'GET';
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { method, headers });
      
      // Status que NÃO devem fazer retry (erros definitivos)
      if ([401, 403, 404].includes(response.status)) {
        return response;
      }
      
      // Rate limit (429) - respeitar Retry-After ou usar backoff com jitter
      if (response.status === 429 && attempt < maxRetries) {
        const retryAfterHeader = response.headers.get('Retry-After');
        let baseWait;
        
        if (retryAfterHeader) {
          baseWait = parseInt(retryAfterHeader) * 1000;
          console.log(`[RETRY] Rate limit (429) - Retry-After header: ${retryAfterHeader}s`);
        } else {
          baseWait = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s
          console.log(`[RETRY] Rate limit (429) - No Retry-After, using exponential backoff`);
        }
        
        // Adicionar jitter (0-300ms) para evitar colisões
        const jitter = Math.floor(Math.random() * 300);
        const waitTime = baseWait + jitter;
        
        console.log(`[RETRY] Status: 429, Attempt: ${attempt + 1}/${maxRetries}, Wait: ${waitTime}ms (base: ${baseWait}ms + jitter: ${jitter}ms)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // Erros de servidor (500, 502, 503, 504) - fazer retry
      if ([500, 502, 503, 504].includes(response.status) && attempt < maxRetries) {
        const baseWait = Math.pow(2, attempt) * 1000;
        const jitter = Math.floor(Math.random() * 300);
        const waitTime = baseWait + jitter;
        
        console.log(`[RETRY] Server error (${response.status}), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      // Retry em erros de rede
      if (attempt < maxRetries) {
        const baseWait = Math.pow(2, attempt) * 1000;
        const jitter = Math.floor(Math.random() * 300);
        const waitTime = baseWait + jitter;
        
        console.log(`[RETRY] Network error, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}:`, error.message);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

export async function validateToken(storeId, token) {
  const headers = getNuvemshopHeaders(token);
  const url = `https://api.nuvemshop.com.br/v1/${storeId}/store`;
  
  const response = await fetchWithRetry(url, { headers, method: 'GET' });
  
  return {
    valid: response.ok,
    status: response.status,
    response
  };
}