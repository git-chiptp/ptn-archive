import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'add-transcript/**', renderMode: RenderMode.Client },
  { path: 'add-chapter/**', renderMode: RenderMode.Client },
  { path: 'stage-organizer/**', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
