export interface AppsScriptClient {
  call<T = unknown>(action: string, params: Record<string, unknown>): Promise<T>;
}

export function createAppsScriptClient(opts: { url: string; adminToken: string }): AppsScriptClient {
  return {
    async call<T>(action: string, params: Record<string, unknown>): Promise<T> {
      const qs = new URLSearchParams();
      qs.set('action', action);
      qs.set('admin_token', opts.adminToken);
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        qs.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
      // NOTE: Uses GET with query params, not POST. The Workspace org policy
      // on malearnsa.com blocks POST to Apps Script web apps ("Anyone" access).
      // GET works for both staging and prod; Apps Script routes both through
      // doGet which has the admin_* action cases.
      const res = await fetch(`${opts.url}?${qs.toString()}`, {
        method: 'GET',
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`apps_script_http_${res.status}`);
      const json = (await res.json()) as { ok?: boolean; error?: string } & T;
      if (json.ok === false) throw new Error(`apps_script_${json.error ?? 'unknown'}`);
      return json as T;
    },
  };
}
