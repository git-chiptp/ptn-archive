import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Category } from '../../models/transcript.models';
import { AuthService } from '../../services/auth.service';
import { ArchiveStore } from '../../services/archive.store';
import { LanguageService } from '../../services/language.service';
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BreadcrumbModule, ButtonModule, InputTextModule],
  templateUrl: './catalog.page.html',
})
export class CatalogPage {
  private store = inject(ArchiveStore);

  readonly auth = inject(AuthService);

  readonly language = inject(LanguageService);

  private router = inject(Router);

  public get isAdmin() {
    return !!this.auth.user();
  }

  private route = inject(ActivatedRoute);

  public query = '';

  public category = this.route.snapshot.data['category'] as Category;

  public readonly breadcrumbHome: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  public get breadcrumbItems(): MenuItem[] {
    return [{ label: this.title }];
  }

  public get collectionCardsAreLinks() {
    return true;
  }

  public openCollection(label: string, event?: Event) {
    const target = event?.target;
    if (target instanceof HTMLElement && target.closest('a, button')) {
      return;
    }
    this.router.navigate(['/', this.category, this.slug(label)]);
  }

  public get title() {
    return this.language.text(
      this.category === 'main-story'
        ? 'mainStory'
        : this.category === 'eternal-nightmare'
          ? 'eternalNightmare'
        : this.category === 'event-story'
          ? 'eventStory'
          : this.category,
    );
  }

  public get filteredCollections() {
    const q = this.query.toLowerCase();
    return this.store
      .collections(this.category)
      .map((c) => ({
        ...c,
        stages: c.stages.filter((s) => !q || `${c.label} ${s.label}`.toLowerCase().includes(q)),
      }))
      .filter(
        (c) =>
          this.category === 'main-story' ||
          this.category === 'eternal-nightmare' ||
          this.category === 'event-story' ||
          c.stages.length ||
          this.store.chapters().some((chapter) => chapter.id === c.id),
      );
  }

  public slug(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
