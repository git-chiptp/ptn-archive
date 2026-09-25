import { Routes } from '@angular/router';
import { App } from './app';
import { AdminPage } from './pages/admin/admin.page';
import { CatalogPage } from './pages/catalog/catalog.page';
import { HomePage } from './pages/home/home.page';
import { ReaderPage } from './pages/reader/reader.page';
export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'main-story', component: CatalogPage, data: { category: 'main-story' } },
  { path: 'event-story', component: CatalogPage, data: { category: 'event-story' } },
  { path: 'interrogation', component: CatalogPage, data: { category: 'interrogation' } },
  { path: 'perspectra', component: CatalogPage, data: { category: 'perspectra' } },
  { path: 'main-story/:chapterId/:stageId', component: ReaderPage },
  { path: 'event-story/:eventId/:stageId', component: ReaderPage },
  { path: 'interrogation/:characterId/:partId', component: ReaderPage },
  { path: 'perspectra/:chapterId/:stageId', component: ReaderPage },
  { path: 'admin', component: AdminPage },
  { path: '**', redirectTo: '' },
];
