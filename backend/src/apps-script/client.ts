export interface AppsScriptClient {
  call<T = unknown>(action: string, params: Record<string, unknown>): Promise<T>;
}

export function createAppsScriptClient(opts: { url: string; adminToken: string }): AppsScriptClient {
  return {
    async call<T>(action: string, params: Record<string, unknown>): Promise<T> {
      const body = new URLSearchParams();
      body.set('action', action);
      body.set('admin_token', opts.adminToken);
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        body.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
      const res = await fetch(opts.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`apps_script_http_${res.status}`);
      const json = (await res.json()) as { ok?: boolean; error?: string } & T;
      if (json.ok === false) throw new Error(`apps_script_${json.error ?? 'unknown'}`);
      return json as T;
    },
  };
}
