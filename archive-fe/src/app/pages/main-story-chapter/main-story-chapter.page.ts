import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { Category } from '../../models/transcript.models';
import { AuthService } from '../../services/auth.service';
import { ArchiveStore } from '../../services/archive.store';
import { LanguageService } from '../../services/language.service';
import { ButtonModule } from 'primeng/button';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, BreadcrumbModule],
  templateUrl: './main-story-chapter.page.html',
})
export class MainStoryChapterPage {
  readonly store = inject(ArchiveStore);

  readonly auth = inject(AuthService);

  readonly language = inject(LanguageService);

  private route = inject(ActivatedRoute);

  public get category(): Category {
    return (this.route.snapshot.data['category'] as Category | undefined) ?? 'main-story';
  }

  public readonly breadcrumbHome: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  public get breadcrumbItems(): MenuItem[] {
    return [
      {
        label: this.language.text(
          this.category === 'main-story' ? 'mainStory' : 'eternalNightmare',
        ),
        routerLink: '/' + this.category,
      },
      ...(this.chapter ? [{ label: this.chapter.label }] : []),
    ];
  }

  public get chapter() {
    const slug = this.route.snapshot.paramMap.get('chapterId');
    return this.store
      .collections(this.category)
      .find((collection) => this.slug(collection.label) === slug);
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
