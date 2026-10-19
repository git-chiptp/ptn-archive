import { InjectionToken, Provider } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('Supabase client');

export function assertDevelopmentSupabaseUrl(config: { production: boolean; supabaseUrl: string }): void {
  if (config.production) return;

  let url: URL;
  try {
    url = new URL(config.supabaseUrl);
  } catch {
    throw new Error('Development Supabase URL must point to a local HTTP server.');
  }

  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password
  ) {
    throw new Error('Development Supabase URL must point to a local HTTP server.');
  }
}

export function provideSupabaseClient(): Provider {
  assertDevelopmentSupabaseUrl(environment);

  return {
    provide: SUPABASE_CLIENT,
    useFactory: () => {
      if (!environment.supabaseUrl || !environment.supabasePublishableKey) {
        throw new Error('Supabase URL and publishable key must be configured.');
      }
      return createClient(environment.supabaseUrl, environment.supabasePublishableKey);
    },
  };
}
