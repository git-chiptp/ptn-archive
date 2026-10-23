type MediaProvider = 'supabase' | 'r2';

export const environment: {
  production: boolean;
  supabaseUrl: string;
  supabasePublishableKey: string;
  mediaProvider: MediaProvider;
  r2ApiUrl: string;
  r2PublicUrl: string;
} = {
  production: false,
  supabaseUrl: 'http://127.0.0.1:54321',
  supabasePublishableKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  mediaProvider: 'supabase',
  r2ApiUrl: '',
  r2PublicUrl: '',
};
