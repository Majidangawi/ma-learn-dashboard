# Brevo + DNS Setup Runbook (one-time)

Follow this once to get the newsletter stack online. ~20 minutes total.

---

## Step 1 — Create Brevo account

1. Go to https://www.brevo.com → **Sign up** (free forever plan).
2. Use `majed.engawi@gmail.com` as the account email.
3. Skip onboarding; when asked about use case, pick **Transactional email**.
4. Confirm the signup email in Gmail (verification link).

## Step 2 — Add your sender domain

1. In Brevo left nav: **Senders, Domains & Dedicated IPs → Domains → Add a domain**.
2. Enter `newsletter.malearnsa.com`.
3. Brevo will show 3 DNS records (DKIM TXT, SPF TXT, DMARC TXT). Keep this tab open — you'll copy the exact values in Step 3.

## Step 3 — Add DNS records at malearnsa.com registrar

Log in to wherever `malearnsa.com` is registered (GoDaddy / Namecheap / Cloudflare / etc.). In the DNS manager, add the 3 records Brevo provided. Typical shape:

| Type | Host / Name | Value |
|---|---|---|
| TXT | `brevo-code._domainkey.newsletter` | `v=DKIM1; k=rsa; p=<long key Brevo gives you>` |
| TXT | `newsletter` | `v=spf1 include:spf.brevo.com ~all` |
| TXT | `_dmarc.newsletter` | `v=DMARC1; p=none; rua=mailto:majed.engawi@gmail.com` |

Save. Propagation: 5–30 minutes, sometimes an hour.

## Step 4 — Authenticate in Brevo

Go back to the domain row in Brevo → click **Authenticate / Verify records**. Brevo shows green checks next to each record once DNS resolves.

If red after 30 minutes: run `npx tsx backend/scripts/verify-brevo-dns.ts` locally to debug — it'll tell you which record isn't resolving.

## Step 5 — Generate API key

1. Brevo: **SMTP & API → API Keys → Generate a new API key**.
2. Name: `ma-learn-dashboard`.
3. Copy the key — it starts with `xkeysib-`. You won't see it again.

## Step 6 — Paste env vars on the droplet

SSH in and append to the staging env file:

```bash
ssh root@46.101.151.237
cat >> /etc/ma-learn-dashboard/.env.staging <<'EOF'
BREVO_API_KEY=xkeysib-PASTE_YOUR_KEY_HERE
BREVO_WEBHOOK_SECRET=GENERATE_A_RANDOM_32_CHAR_STRING
BREVO_SENDER_EMAIL=hello@newsletter.malearnsa.com
BREVO_SENDER_NAME=Majid Angawi
PUBLIC_BASE_URL=https://api-staging.malearnsa.com
EMAIL_ASSETS_FOLDER_ID=SET_AFTER_CREATING_DRIVE_FOLDER_IN_TASK_10
EOF
pm2 restart ma-learn-dashboard-staging --update-env
```

To generate a 32-char random webhook secret:
```bash
openssl rand -hex 16
```

## Step 7 — Configure webhook in Brevo

1. Brevo: **Transactional → Settings → Webhook → Add a new webhook**.
2. URL: `https://api-staging.malearnsa.com/api/webhooks/brevo`
3. Events: check all of `delivered`, `opened`, `clicked`, `soft_bounce`, `hard_bounce`, `unsubscribed`.
4. Authentication → Custom header:
   - Header name: `Authorization`
   - Header value: the `BREVO_WEBHOOK_SECRET` you set in Step 6
5. Save.

## Step 8 — Verify DNS from the droplet

```bash
cd ~/code/ma-learn-dashboard/backend
npx tsx scripts/verify-brevo-dns.ts
```

Expected output:
```
Verifying DNS for newsletter.malearnsa.com

SPF:   PASS
DKIM:  PASS
DMARC: PASS
```

If any record shows FAIL, double-check the Host field at your registrar. Common mistake: registrar auto-appends the domain, so typing `brevo-code._domainkey.newsletter.malearnsa.com` becomes `brevo-code._domainkey.newsletter.malearnsa.com.malearnsa.com`. Use the shorter host form the table above.

## Step 9 — Send a test email

From your laptop:

```bash
# Replace <cookie> with your auth_session cookie from admin-staging.malearnsa.com
curl -s https://api-staging.malearnsa.com/api/writes/newsletter/test_send \
  -H "Cookie: auth_session=<cookie>" \
  -H "Content-Type: application/json" \
  -d '{"to":"majed.engawi@gmail.com","subject":"Brevo test","html":"<h1>hello from Noor</h1>"}'
```

You should receive the email at `majed.engawi@gmail.com` within ~30 seconds. **Check inbox AND spam** — if it lands in spam on the first send, that's normal for a brand-new sender domain; reputation builds over the first 10–20 sends.

---

## Troubleshooting

- **Authentication still red after an hour** — your registrar may have DNSSEC or proxying enabled. If using Cloudflare, set the TXT records to **DNS only** (grey cloud, not orange).
- **Test email not arriving** — check droplet logs: `pm2 logs ma-learn-dashboard-staging`. Look for `brevo_send_failed` or similar.
- **Webhook events not landing in NewsletterEvents sheet** — verify the `Authorization` header value in Brevo exactly matches `BREVO_WEBHOOK_SECRET` in the droplet env (case-sensitive, no trailing whitespace).
