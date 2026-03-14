const supabaseKey =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL is required.");
}

if (!supabaseKey) {
  throw new Error(
    "Either SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY is required."
  );
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey
};
