import { DOCUMENT } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { usePreset } from '@primeuix/themes';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MenuModule } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { archiveBluePreset, archiveGreyPreset, archiveLightPreset } from '../../archive.theme';

type Theme = 'light' | 'dark-blue' | 'dark';

@Component({
  standalone: true,
  imports: [FormsModule, ButtonModule, DrawerModule, MenuModule, SelectModule],
  selector: 'app-navigation',
  templateUrl: './app-navigation.component.html',
})
export class AppNavigationComponent implements OnInit {
  readonly language = inject(LanguageService);
  readonly auth = inject(AuthService);

  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  public theme: Theme = 'light';
  public drawerOpen = false;
  public drawerPosition: 'left' = 'left';

  public readonly navItems: readonly {
    icon: string;
    label: string;
    path: string;
    requiresAuth?: boolean;
  }[] = [
    { icon: 'book', label: 'mainStory', path: '/main-story' },
    { icon: 'calendar', label: 'events', path: '/event-story' },
    { icon: 'moon', label: 'eternalNightmare', path: '/eternal-nightmare' },
    { icon: 'comments', label: 'interrogation', path: '/interrogation' },
    { icon: 'eye', label: 'mirage', path: '/mirage' },
    { icon: 'chart-line', label: 'perspectra', path: '/perspectra' },
    { icon: 'language', label: 'glossary', path: '/glossary' },
    { icon: 'info-circle', label: 'credits', path: '/credits' },
    { icon: 'images', label: 'mediaLibrary', path: '/media', requiresAuth: true },
  ] as const;

  public get navigationMenu(): MenuItem[] {
    const visibleItems = this.auth.user()
      ? this.navItems
      : this.navItems.filter((item) => !item.requiresAuth);
    return visibleItems.map((item) => ({
      label: this.language.text(item.label),
      title: this.language.text(item.label),
      icon: `pi pi-${item.icon}`,
      routerLink: item.path,
      styleClass: this.isActive(item.path) ? 'archive-menu-active' : '',
      command: () => (this.drawerOpen = false),
    }));
  }

  constructor() {}

  ngOnInit() {
    if (typeof localStorage !== 'undefined') {
      const storedTheme = localStorage.getItem('archive-theme');
      if (storedTheme === 'dark-blue' || storedTheme === 'dark' || storedTheme === 'light') {
        this.theme = storedTheme;
      } else {
        this.theme = 'light';
      }
    }
    setTimeout(() => {
      this.applyTheme();
    }, 0);
  }

  private applyTheme() {
    const isLight = this.theme === 'light';
    this.document.documentElement.classList.toggle('dark', !isLight);
    this.document.documentElement.setAttribute('data-theme', this.theme);
    if (this.theme === 'light') {
      usePreset(archiveLightPreset);
    } else if (this.theme === 'dark-blue') {
      usePreset(archiveBluePreset);
    } else {
      usePreset(archiveGreyPreset);
    }
  }

  public navigate(path: string) {
    this.drawerOpen = false;
    this.router.navigateByUrl(path);
  }

  public get themeOptions(): { value: Theme; label: string }[] {
    return [
      { value: 'light', label: this.language.text('light') },
      { value: 'dark-blue', label: this.language.text('darkBlue') },
      { value: 'dark', label: this.language.text('dark') },
    ];
  }

  public setTheme(theme: Theme) {
    this.theme = theme;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('archive-theme', theme);
    }
    this.applyTheme();
  }

  public logout() {
    this.auth.logout().subscribe({
      next: () => this.navigate('/'),
    });
  }

  public isActive(path: string): boolean {
    return this.router.url === path || this.router.url.startsWith(`${path}/`);
  }

  public setLanguage(language: string) {
    this.language.setLanguage(language);
  }
}
