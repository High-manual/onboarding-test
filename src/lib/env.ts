import { z } from "zod";

const browserSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = browserSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ATTEMPTS_STATS_VERSION: z.enum(["v1", "v2"]).default("v1"),
});

export type BrowserEnv = z.infer<typeof browserSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export function getBrowserEnv(): BrowserEnv {
  return browserSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function getServerEnv(): ServerEnv {
  return serverSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ATTEMPTS_STATS_VERSION: process.env.ATTEMPTS_STATS_VERSION as "v1" | "v2" | undefined,
  });
}
