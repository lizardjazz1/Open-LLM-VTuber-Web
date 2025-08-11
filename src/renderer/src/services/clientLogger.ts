/* Client logger: sends logs to backend /logs with token, falls back to WS.
 * Includes: fetchWithTimeout, secret masking, 4KB truncation with hash, client_uid propagation.
 */

import { wsService } from './websocket-service';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || window.location.origin;
const LOG_TOKEN = (import.meta as any).env?.VITE_LOG_TOKEN || '';
const APP_VERSION = (import.meta as any).env?.VITE_APP_VERSION || 'dev';

let CLIENT_UID: string | null = null;
export function setClientUid(uid: string) {
  CLIENT_UID = uid || null;
}

function maskSecrets<T = any>(data: T): T {
  try {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const out: any = Array.isArray(data) ? [] : {};
      for (const [k, v] of Object.entries(data as any)) {
        if (/^(token|key|secret)[a-z0-9_\-]*/i.test(k)) {
          out[k] = '***';
        } else {
          out[k] = maskSecrets(v as any);
        }
      }
      return out;
    }
    if (Array.isArray(data)) return (data as any[]).map((v) => maskSecrets(v)) as any;
    return data;
  } catch {
    return data;
  }
}

function truncateAndHashText(text: string, limitBytes = 4096) {
  try {
    const enc = new TextEncoder().encode(String(text));
    const hash = crypto && 'subtle' in crypto ? null : null; // placeholder; we do short hash via JS fallback
    const sha = (() => {
      let s = 0;
      for (let i = 0; i < enc.length; i += 1) s = (s * 31 + enc[i]) >>> 0;
      return (s >>> 0).toString(16).slice(0, 8);
    })();
    if (enc.length <= limitBytes) {
      return { input_truncated: String(text), input_hash: sha, truncated: false };
    }
    const preview = enc.slice(0, limitBytes);
    const previewText = new TextDecoder().decode(preview);
    return {
      input_truncated: `${previewText}... [truncated: ${Math.floor(enc.length / 1024)}KB]`,
      input_hash: sha,
      truncated: true,
    };
  } catch {
    const s = String(text);
    return {
      input_truncated: s.slice(0, 4096),
      input_hash: (s.length >>> 0).toString(16).slice(0, 8),
      truncated: s.length > 4096,
    };
  }
}

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = 2000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal, keepalive: true });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function postLog(body: any): Promise<boolean> {
  if (!LOG_TOKEN) return false;
  try {
    const res = await fetchWithTimeout(`${API_BASE}/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Log-Token': LOG_TOKEN,
      },
      body: JSON.stringify(body),
    }, 2000);
    return res.ok;
  } catch {
    return false;
  }
}

export async function logAction(event: string, action: string, params?: any, requestId?: string) {
  const payload = maskSecrets(params ?? {});
  const body = {
    component: 'frontend',
    level: 'ACTION',
    event,
    action,
    params: payload,
    request_id: requestId || null,
    client_uid: CLIENT_UID,
    app_version: APP_VERSION,
    ts: new Date().toISOString(),
  };
  const ok = await postLog(body);
  if (!ok) {
    // Fallback: send via WS as standard frontend-log
    wsService.logClient('info', body);
  }
}

export async function logError(message: string, details?: any, requestId?: string) {
  const masked = maskSecrets(details ?? {});
  let truncated = undefined as any;
  if (masked && typeof masked === 'object' && 'stack' in masked && typeof masked.stack === 'string') {
    truncated = { ...masked, stack: truncateAndHashText(masked.stack).input_truncated };
  } else {
    truncated = masked;
  }
  const body = {
    component: 'frontend',
    level: 'error',
    message,
    details: truncated,
    request_id: requestId || null,
    client_uid: CLIENT_UID,
    app_version: APP_VERSION,
    ts: new Date().toISOString(),
  };
  const ok = await postLog(body);
  if (!ok) {
    // Fallback: send via WS as standard frontend-log
    wsService.logClient('error', body);
  }
} 