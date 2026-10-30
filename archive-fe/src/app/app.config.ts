import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { credentialsInterceptor } from './interceptors/credentials.interceptor';
import { provideSupabaseClient } from './services/supabase.client';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService } from 'primeng/api';
import { archiveLightPreset } from './archive.theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([credentialsInterceptor])),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'disabled',
      }),
    ),
    provideSupabaseClient(),
    ConfirmationService,
    providePrimeNG({
      theme: {
        preset: archiveLightPreset,
        options: {
          darkModeSelector: '.dark',
        },
      },
      license: 'eyJpZCI6ImM2YzA0YThkLTdmMmItNDQzNy1hZWFlLTQ5ZWFjMzBiYjJhOSIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3OTE1OTkzMzUsImV4cCI6MTgyMzEzNTMzNX0._e0Q5aChsFdeoB3YXCI_ygLbjPoFph1k1d_vGkMLo2-CHyLgMgXORL_pPMYCollvWjPYKCo1fTutSaIrI_6AAw'
    })
  ],
};
