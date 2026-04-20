import { readNewsletters } from '../data/newsletters.js';
import { readSubscribers } from '../data/subscribers.js';
import { applyFilter } from '../data/segment-filter.js';
import { renderBlocks } from '../mail/blocks.js';
import { createBrevoProvider } from '../mail/provider.js';

interface AppsScriptLike {
  call<T>(action: string, params: Record<string, unknown>): Promise<T>;
}

interface Args {
  newsletterId: string;
  appsScript: AppsScriptLike;
}

export async function sendNewsletter(args: Args): Promise<{ ok: boolean; sent?: number; error?: string }> {
  const newsletters = await readNewsletters();
  const nl = newsletters.find(n => n.newsletterId === args.newsletterId);
  if (!nl) return { ok: false, error: 'not_found' };
  if (nl.status === 'sent' || nl.status === 'sending') return { ok: false, error: 'already_' + nl.status };

  // Atomic flip to 'sending' — if this fails (status mismatch), another process beat us.
  try {
    await args.appsScript.call('admin_mark_newsletter_status', {
      newsletterId: nl.newsletterId,
      fromStatus: nl.status,
      toStatus: 'sending',
    });
  } catch (_e) {
    return { ok: false, error: 'status_transition_failed' };
  }

  try {
    const subs = await readSubscribers();
    const recipients = applyFilter(subs, nl.segmentFilter).filter(s => s.language === nl.language);

    const brevoKey = process.env.BREVO_API_KEY;
    if (!brevoKey) throw new Error('BREVO_API_KEY missing');
    const provider = createBrevoProvider({ apiKey: brevoKey });
    const fromEmail = process.env.BREVO_SENDER_EMAIL;
    if (!fromEmail) throw new Error('BREVO_SENDER_EMAIL missing');
    const fromName = process.env.BREVO_SENDER_NAME ?? 'Majid Angawi';
    const baseUrl = process.env.PUBLIC_BASE_URL ?? 'https://api-staging.malearnsa.com';

    // Send one-by-one so each recipient gets a per-user unsubscribe URL in the
    // rendered HTML + List-Unsubscribe header. Brevo allows larger fan-out,
    // but the per-recipient substitution is what keeps this correct.
    let sent = 0;
    for (const r of recipients) {
      const unsubUrl = `${baseUrl}/api/public/unsubscribe?token=${encodeURIComponent(r.unsubscribeToken)}`;
      const html = renderBlocks(nl.blocks, nl.language, {
        name: r.name || '',
        unsubscribeUrl: unsubUrl,
      });
      const result = await provider.sendCampaign({
        from: { name: fromName, email: fromEmail },
        to: [{ email: r.email, name: r.name }],
        subject: nl.subject,
        htmlContent: html,
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Newsletter-Id': nl.newsletterId,
        },
        tags: [`nl:${nl.newsletterId}`],
      });
      if (result.ok) sent++;
    }

    await args.appsScript.call('admin_mark_newsletter_status', {
      newsletterId: nl.newsletterId,
      fromStatus: 'sending',
      toStatus: 'sent',
      recipientCount: recipients.length,
    });

    return { ok: true, sent };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'send_failed';
    await args.appsScript.call('admin_mark_newsletter_status', {
      newsletterId: nl.newsletterId,
      toStatus: 'failed',
    });
    return { ok: false, error: msg };
  }
}
