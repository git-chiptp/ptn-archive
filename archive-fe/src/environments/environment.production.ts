type RuntimeSupabaseConfig = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

const runtimeConfig = (globalThis as typeof globalThis & {
  __ARCHIVE_SUPABASE_CONFIG__?: RuntimeSupabaseConfig;
}).__ARCHIVE_SUPABASE_CONFIG__;

export const environment = {
  production: true,
  supabaseUrl: runtimeConfig?.supabaseUrl ?? '',
  supabasePublishableKey: runtimeConfig?.supabasePublishableKey ?? '',
};
