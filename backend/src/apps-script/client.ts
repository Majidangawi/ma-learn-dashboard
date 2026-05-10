export interface AppsScriptClient {
  call<T = unknown>(action: string, params: Record<string, unknown>): Promise<T>;
}

export function createAppsScriptClient(opts: { url: string; adminToken: string; sheetId?: string }): AppsScriptClient {
  return {
    async call<T>(action: string, params: Record<string, unknown>): Promise<T> {
      const qs = new URLSearchParams();
      qs.set('action', action);
      qs.set('admin_token', opts.adminToken);
      if (opts.sheetId && !('sheetId' in params)) qs.set('sheetId', opts.sheetId);
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        qs.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
      // Default GET (most actions). Switch to POST when the URL would exceed
      // Google's ~16KB cap — this is server-to-server (no CORS preflight), so
      // the Workspace org policy that blocks browser-side POST does not apply.
      // The Apps Script doPost merges e.parameter (querystring) with the parsed
      // body, so action+admin_token stay in the URL and the heavy fields ride
      // in the form body.
      const url = `${opts.url}?${qs.toString()}`;
      const URL_LIMIT = 6000;
      let res: Response;
      if (url.length <= URL_LIMIT) {
        res = await fetch(url, { method: 'GET', redirect: 'follow' });
      } else {
        const small = new URLSearchParams();
        small.set('action', action);
        small.set('admin_token', opts.adminToken);
        if (opts.sheetId && !('sheetId' in params)) small.set('sheetId', opts.sheetId);
        const body = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) {
          if (v === undefined || v === null) continue;
          body.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        }
        res = await fetch(`${opts.url}?${small.toString()}`, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
      }
      if (!res.ok) throw new Error(`apps_script_http_${res.status}`);
      const json = (await res.json()) as { ok?: boolean; error?: string } & T;
      if (json.ok === false) throw new Error(`apps_script_${json.error ?? 'unknown'}`);
      return json as T;
    },
  };
}
