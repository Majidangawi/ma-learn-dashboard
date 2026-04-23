import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['staging', 'production']),
  PORT: z.coerce.number().default(3400),
  ALLOWED_ADMIN_EMAIL: z.string().email(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  SHEET_ID: z.string().min(1).optional(),
  // Dashboard-owned tabs (EmailTemplates, LinkInBio, LinkInBioHeader, AuditLog)
  // can live on a different sheet from the shared business data (Tokens,
  // Lessons, Customers, etc.). When unset, falls back to SHEET_ID.
  SHEET_ID_ADMIN: z.string().min(1).optional(),
  APPS_SCRIPT_URL: z.string().url().optional().or(z.literal('')),
  BACKEND_OAUTH_CLIENT_ID: z.string().min(1),
  BACKEND_OAUTH_CLIENT_SECRET: z.string().min(1),
  BACKEND_OAUTH_REFRESH_TOKEN: z.string().min(1),
  GMAIL_SENDER: z.string().email(),
  ANTHROPIC_API_KEY: z.string().optional(),
  NOOR_MONTHLY_CAP_USD: z.coerce.number().default(100),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  PASSWORD_HASH: z.string().optional(),
  APPS_SCRIPT_ADMIN_TOKEN: z.string().min(1).default('dev-token-not-set'),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return schema.parse(env);
}
