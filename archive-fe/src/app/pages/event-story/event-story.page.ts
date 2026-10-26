import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../services/auth.service';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ArchiveStore } from '../../services/archive.store';
import { LanguageService } from '../../services/language.service';
import { ButtonModule } from 'primeng/button';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, BreadcrumbModule],
  templateUrl: './event-story.page.html',
})
export class EventStoryPage {
  readonly store = inject(ArchiveStore);
  readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);
  private route = inject(ActivatedRoute);
  public readonly breadcrumbHome: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  public get breadcrumbItems(): MenuItem[] {
    return [
      { label: this.language.text('eventStory'), routerLink: '/event-story' },
      ...(this.event ? [{ label: this.event.label }] : []),
    ];
  }

  public get event() {
    const slug = this.route.snapshot.paramMap.get('eventId');
    return this.store
      .collections('event-story')
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
