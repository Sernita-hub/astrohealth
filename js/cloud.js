/* =========================================================================
   AstroHealth · Cloud link to Mission Control (Supabase)
   Reports to Earth are stored in a Supabase database, so they really reach
   "Mission Control". It talks to the Supabase REST API directly (no
   library), signs in anonymously (no registration needed) and keeps the
   app offline-first: reports wait in an outbox until there is a signal.
   The publishable key below is meant to be public. Row Level Security in the
   database (see supabase/schema.sql) lets each device reach only its own
   reports. Leave url or key empty to run fully offline (simulated link).
   SI notice: generated with Claude (Anthropic), a Super Intelligence (SI)
   tool. See README, "Use of Super Intelligence (SI)".
   ========================================================================= */
(function () {
  'use strict';
  const V = window.AH;

  const CONFIG = {
    url: 'https://ugodypkcqoehzxfodobc.supabase.co',
    key: 'sb_publishable_K1gHZ62RgUzLGvvsTTt_Jg_gotpbWR-'
  };

  const SESSION_KEY = 'astrohealth.cloud.v1';
  const TIMEOUT_MS = 12000;
  const COLUMNS = 'id,client_id,created_at,onboard_at,astronaut,mission,environment,mission_day,delay_sec,score,level,alert_count,lang,report';
  let session;              // undefined = not read yet, null = none
  let pendingSession = null;

  const enabled = () => !!(CONFIG.url && CONFIG.key);

  /* Error with a kind the interface can explain:
     offline (no connection) · auth · server · rejected (invalid data or limit) · disabled */
  class CloudError extends Error {
    constructor(kind, message, status) {
      super(message);
      this.kind = kind;
      this.status = status || 0;
    }
  }

  function readSession() {
    if (session !== undefined) return session;
    session = null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) session = JSON.parse(raw);
    } catch (e) { /* storage unavailable: the session lives in memory only */ }
    return session;
  }

  function writeSession(s) {
    session = s || null;
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* storage unavailable */ }
  }

  async function request(path, opts = {}) {
    if (!enabled()) throw new CloudError('disabled', 'Cloud link not configured');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new CloudError('offline', 'No connection');
    const headers = { apikey: CONFIG.key, 'Content-Type': 'application/json' };
    if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
    Object.assign(headers, opts.headers || {});
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
    let res;
    try {
      res = await fetch(CONFIG.url + path, {
        method: opts.method || 'GET',
        headers,
        body: opts.body == null ? undefined : JSON.stringify(opts.body),
        signal: ctrl ? ctrl.signal : undefined
      });
    } catch (e) {
      throw new CloudError('offline', 'Network error');
    } finally {
      if (timer) clearTimeout(timer);
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const msg = (data && (data.message || data.msg || data.error_description || data.error)) || ('HTTP ' + res.status);
      const kind = res.status === 401 || res.status === 403 ? 'auth' : res.status >= 500 ? 'server' : 'rejected';
      throw new CloudError(kind, String(msg), res.status);
    }
    return data;
  }

  const toSession = (d) => ({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at ? d.expires_at * 1000 : Date.now() + (d.expires_in || 3600) * 1000,
    user_id: d.user ? d.user.id : (readSession() || {}).user_id
  });

  /* Anonymous session for this device: refreshed when it expires, created on first use */
  function ensureSession(force) {
    const s = readSession();
    if (!force && s && s.access_token && s.expires_at - Date.now() > 60000) return Promise.resolve(s);
    if (pendingSession) return pendingSession;
    pendingSession = (async () => {
      if (s && s.refresh_token) {
        try {
          const d = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } });
          writeSession(toSession(d));
          return session;
        } catch (e) {
          if (e.kind === 'offline' || e.kind === 'server') throw e;
          // The refresh token is no longer valid: start a new anonymous session
        }
      }
      const d = await request('/auth/v1/signup', { method: 'POST', body: { data: {} } });
      if (!d || !d.access_token) throw new CloudError('auth', 'Anonymous sign-in is not available');
      writeSession(toSession(d));
      return session;
    })().finally(() => { pendingSession = null; });
    return pendingSession;
  }

  async function authed(path, opts = {}) {
    let s = await ensureSession();
    try {
      return await request(path, Object.assign({}, opts, { token: s.access_token }));
    } catch (e) {
      if (e.status !== 401) throw e;
      s = await ensureSession(true); // expired token: refresh once and retry
      return request(path, Object.assign({}, opts, { token: s.access_token }));
    }
  }

  V.cloud = {
    enabled,
    provider: 'Supabase',
    host() {
      try { return new URL(CONFIG.url).host; } catch (e) { return ''; }
    },
    /* Short anonymous ID of this device, or null before the first connection */
    deviceId() {
      const s = readSession();
      return s && s.user_id ? s.user_id.slice(0, 8) : null;
    },
    /* Stores one report. A report that already arrived (same client_id) counts as delivered. */
    async send(row) {
      try {
        const d = await authed('/rest/v1/reports', { method: 'POST', body: row, headers: { Prefer: 'return=representation' } });
        return Array.isArray(d) ? d[0] : d;
      } catch (e) {
        if (e.status === 409) return { client_id: row.client_id, duplicate: true };
        throw e;
      }
    },
    /* Latest reports received from this device, newest first */
    list(limit = 30) {
      return authed(`/rest/v1/reports?select=${COLUMNS}&order=created_at.desc&limit=${limit}`);
    },
    /* Deletes this device's reports from the cloud and forgets its anonymous ID */
    async removeAll() {
      const s = readSession();
      if (!s || !s.user_id) { writeSession(null); return; }
      await authed(`/rest/v1/reports?user_id=eq.${encodeURIComponent(s.user_id)}`, { method: 'DELETE' });
      writeSession(null);
    },
    forget() { writeSession(null); }
  };
})();
