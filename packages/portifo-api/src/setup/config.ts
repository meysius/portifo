import { z } from 'zod';
import { SWConfig } from 'simple-wire';

export const ConfigSchema = z.object({
  // Required to satisfy the simple-wire Config interface
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PORT: z.coerce.number().min(1000),

  // Add your custom config variables here
  DATABASE_URL: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  SESSION_SECRET: z.string(),
  VAPID_PUBLIC_KEY: z.string(),
  VAPID_PRIVATE_KEY: z.string(),
  VAPID_CONTACT_EMAIL: z.string(),
}) satisfies z.ZodType<SWConfig>;

export type Config = z.infer<typeof ConfigSchema>;