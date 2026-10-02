import { Routes } from '@angular/router';
import { AdminPage } from './pages/admin/admin.page';
import { AddChapterPage } from './pages/add-chapter/add-chapter.page';
import { CatalogPage } from './pages/catalog/catalog.page';
import { MainStoryChapterPage } from './pages/main-story-chapter/main-story-chapter.page';
import { EventStoryPage } from './pages/event-story/event-story.page';
import { PerspectraCharacterPage } from './pages/perspectra-character/perspectra-character.page';
import { PerspectraChapterPage } from './pages/perspectra-chapter/perspectra-chapter.page';
import { InterrogationCharacterPage } from './pages/interrogation-character/interrogation-character.page';
import { HomePage } from './pages/home/home.page';
import { ReaderPage } from './pages/reader/reader.page';
import { LoginPage } from './pages/login/login.page';
import { authGuard } from './guards/auth.guard';
export const routes: Routes = [
  {
    path: '',
    component: HomePage
  },
  {
    path: 'main-story',
    component: CatalogPage,
    data: { category: 'main-story' }
  },
  {
    path: 'event-story',
    component: CatalogPage,
    data: { category: 'event-story' }
  },
  {
    path: 'interrogation',
    component: CatalogPage,
    data: { category: 'interrogation' }
  },
  {
    path: 'perspectra',
    component: CatalogPage,
    data: { category: 'perspectra' }
  },
  {
    path: 'main-story/:chapterId',
    component: MainStoryChapterPage
  },
  {
    path: 'main-story/:chapterId/:stageId',
    component: ReaderPage
  },
  {
    path: 'event-story/:eventId',
    component: EventStoryPage
  },
  {
    path: 'event-story/:eventId/:stageId',
    component: ReaderPage
  },
  {
    path: 'interrogation/:characterId',
    component: InterrogationCharacterPage
  },
  {
    path: 'interrogation/:characterId/:partId',
    component: ReaderPage
  },
  {
    path: 'perspectra/:characterId/:chapterId/:partId',
    component: ReaderPage
  },
  {
    path: 'perspectra/:characterId/:chapterId',
    component: PerspectraChapterPage
  },
  {
    path: 'perspectra/:characterId',
    component: PerspectraCharacterPage
  },
  {
    path: 'login',
    component: LoginPage
  },
  {
    path: 'add-transcript',
    component: AdminPage,
    canActivate: [authGuard]
  },
  {
    path: 'add-chapter',
    component: AddChapterPage,
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: ''
  },
];
