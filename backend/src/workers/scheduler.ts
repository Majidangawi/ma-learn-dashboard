import cron from 'node-cron';
import { readNewsletters as defaultRead } from '../data/newsletters.js';
import { sendNewsletter as defaultSend } from '../services/send-newsletter.js';

interface AppsScriptLike {
  call<T>(action: string, params: Record<string, unknown>): Promise<T>;
}

interface TickOpts {
  now: Date;
  readNewsletters: typeof defaultRead;
  sendNewsletter: (args: { newsletterId: string }) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * One scheduler tick: fetch all newsletters, pick those with status=scheduled
 * whose scheduledAt (interpreted as KSA/Asia_Riyadh time) is <= now, and dispatch
 * them via sendNewsletter. Idempotent — send-newsletter flips status to 'sending'
 * atomically so two ticks racing never double-send.
 */
export async function runSchedulerTick(opts: TickOpts): Promise<void> {
  const list = await opts.readNewsletters();
  const due = list.filter(nl => {
    if (nl.status !== 'scheduled' || !nl.scheduledAt) return false;
    // Apps Script writes scheduledAt as 'YYYY-MM-DD HH:mm:ss' in KSA local time.
    const sendAt = new Date(nl.scheduledAt.replace(' ', 'T') + '+03:00');
    if (Number.isNaN(sendAt.getTime())) return false;
    return sendAt <= opts.now;
  });
  for (const nl of due) {
    try {
      await opts.sendNewsletter({ newsletterId: nl.newsletterId });
    } catch (e) {
      console.error(`[scheduler] send failed for ${nl.newsletterId}`, e);
    }
  }
}

export function startScheduler(appsScript: AppsScriptLike): void {
  cron.schedule('* * * * *', async () => {
    try {
      await runSchedulerTick({
        now: new Date(),
        readNewsletters: defaultRead,
        sendNewsletter: ({ newsletterId }) => defaultSend({ newsletterId, appsScript }),
      });
    } catch (e) {
      console.error('[scheduler] tick error', e);
    }
  });
  console.log('[scheduler] started — ticking every 60s');
}
