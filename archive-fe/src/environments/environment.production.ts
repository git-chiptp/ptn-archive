type RuntimeArchiveConfig = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  mediaProvider?: 'supabase' | 'r2';
  r2ApiUrl?: string;
  r2PublicUrl?: string;
};

const runtimeConfig = (
  globalThis as typeof globalThis & {
    __ARCHIVE_SUPABASE_CONFIG__?: RuntimeArchiveConfig;
  }
).__ARCHIVE_SUPABASE_CONFIG__;

type MediaProvider = 'supabase' | 'r2';

export const environment: {
  production: boolean;
  supabaseUrl: string;
  supabasePublishableKey: string;
  mediaProvider: MediaProvider;
  r2ApiUrl: string;
  r2PublicUrl: string;
} = {
  production: true,
  supabaseUrl: runtimeConfig?.supabaseUrl ?? '',
  supabasePublishableKey: runtimeConfig?.supabasePublishableKey ?? '',
  mediaProvider: runtimeConfig?.mediaProvider ?? 'supabase',
  r2ApiUrl: runtimeConfig?.r2ApiUrl ?? '',
  r2PublicUrl: runtimeConfig?.r2PublicUrl ?? '',
};
