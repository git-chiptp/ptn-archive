import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.page').then((page) => page.HomePage),
  },
  {
    path: 'main-story',
    loadComponent: () => import('./pages/catalog/catalog.page').then((page) => page.CatalogPage),
    data: { category: 'main-story' },
  },
  {
    path: 'event-story',
    loadComponent: () => import('./pages/catalog/catalog.page').then((page) => page.CatalogPage),
    data: { category: 'event-story' },
  },
  {
    path: 'eternal-nightmare',
    loadComponent: () => import('./pages/catalog/catalog.page').then((page) => page.CatalogPage),
    data: { category: 'eternal-nightmare' },
  },
  {
    path: 'interrogation',
    loadComponent: () => import('./pages/catalog/catalog.page').then((page) => page.CatalogPage),
    data: { category: 'interrogation' },
  },
  {
    path: 'mirage',
    loadComponent: () => import('./pages/catalog/catalog.page').then((page) => page.CatalogPage),
    data: { category: 'mirage' },
  },
  {
    path: 'perspectra',
    loadComponent: () => import('./pages/catalog/catalog.page').then((page) => page.CatalogPage),
    data: { category: 'perspectra' },
  },
  {
    path: 'credits',
    loadComponent: () => import('./pages/credits/credits.page').then((page) => page.CreditsPage),
  },
  {
    path: 'glossary',
    loadComponent: () => import('./pages/glossary/glossary.page').then((page) => page.GlossaryPage),
  },
  {
    path: 'mirror-system',
    loadComponent: () =>
      import('./pages/mirror-system/mirror-system').then((page) => page.MirrorSystem),
  },
  {
    path: 'stage-organizer',
    loadComponent: () =>
      import('./pages/stage-organizer/stage-organizer.page').then(
        (page) => page.StageOrganizerPage,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'main-story/:chapterId',
    loadComponent: () =>
      import('./pages/main-story-chapter/main-story-chapter.page').then(
        (page) => page.MainStoryChapterPage,
      ),
  },
  {
    path: 'main-story/:chapterId/:stageId',
    loadComponent: () => import('./pages/reader/reader.page').then((page) => page.ReaderPage),
  },
  {
    path: 'eternal-nightmare/:chapterId',
    loadComponent: () =>
      import('./pages/main-story-chapter/main-story-chapter.page').then(
        (page) => page.MainStoryChapterPage,
      ),
    data: { category: 'eternal-nightmare' },
  },
  {
    path: 'eternal-nightmare/:chapterId/:stageId',
    loadComponent: () => import('./pages/reader/reader.page').then((page) => page.ReaderPage),
  },
  {
    path: 'event-story/:eventId',
    loadComponent: () =>
      import('./pages/event-story/event-story.page').then((page) => page.EventStoryPage),
  },
  {
    path: 'event-story/:eventId/:stageId',
    loadComponent: () => import('./pages/reader/reader.page').then((page) => page.ReaderPage),
  },
  {
    path: 'interrogation/:characterId',
    loadComponent: () =>
      import('./pages/interrogation-character/interrogation-character.page').then(
        (page) => page.InterrogationCharacterPage,
      ),
    data: { category: 'interrogation' },
  },
  {
    path: 'interrogation/:characterId/:partId',
    loadComponent: () => import('./pages/reader/reader.page').then((page) => page.ReaderPage),
  },
  {
    path: 'mirage/:characterId',
    loadComponent: () =>
      import('./pages/interrogation-character/interrogation-character.page').then(
        (page) => page.InterrogationCharacterPage,
      ),
    data: { category: 'mirage' },
  },
  {
    path: 'mirage/:characterId/:partId',
    loadComponent: () => import('./pages/reader/reader.page').then((page) => page.ReaderPage),
  },
  {
    path: 'perspectra/:characterId/:chapterId/:partId',
    loadComponent: () => import('./pages/reader/reader.page').then((page) => page.ReaderPage),
  },
  {
    path: 'perspectra/:characterId/:chapterId',
    loadComponent: () =>
      import('./pages/perspectra-chapter/perspectra-chapter.page').then(
        (page) => page.PerspectraChapterPage,
      ),
  },
  {
    path: 'perspectra/:characterId',
    loadComponent: () =>
      import('./pages/perspectra-character/perspectra-character.page').then(
        (page) => page.PerspectraCharacterPage,
      ),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((page) => page.LoginPage),
  },
  {
    path: 'media',
    loadComponent: () => import('./pages/media/media.page').then((page) => page.MediaPage),
    canMatch: [authGuard],
    canActivate: [authGuard],
  },
  {
    path: 'add-transcript',
    loadComponent: () =>
      import('./pages/add-transcript/add-transcript.page').then((page) => page.AddTranscriptPage),
    canActivate: [authGuard],
  },
  {
    path: 'add-chapter',
    loadComponent: () =>
      import('./pages/add-chapter/add-chapter.page').then((page) => page.AddChapterPage),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
