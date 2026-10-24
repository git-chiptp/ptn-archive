import { DOCUMENT } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
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
export class AppNavigationComponent {
  readonly language = inject(LanguageService);
  readonly auth = inject(AuthService);

  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  public theme: Theme = 'light';
  public drawerOpen = false;
  public drawerPosition: 'top' | 'left' = 'left';

  public readonly navItems = [
    { icon: 'book', label: 'mainStory', path: '/main-story' },
    { icon: 'calendar', label: 'events', path: '/event-story' },
    { icon: 'moon', label: 'eternalNightmare', path: '/eternal-nightmare' },
    { icon: 'comments', label: 'interrogation', path: '/interrogation' },
    { icon: 'eye', label: 'mirage', path: '/mirage' },
    { icon: 'chart-line', label: 'perspectra', path: '/perspectra' },
    { icon: 'info-circle', label: 'credits', path: '/credits' },
    { icon: 'images', label: 'mediaLibrary', path: '/media' },
  ] as const;

  public get navigationMenu(): MenuItem[] {
    const visibleItems = this.auth.user()
      ? this.navItems
      : this.navItems.filter((item) => item.path !== '/media');
    return visibleItems.map((item) => ({
      label: this.language.text(item.label),
      title: this.language.text(item.label),
      icon: `pi pi-${item.icon}`,
      routerLink: item.path,
      styleClass: this.isActive(item.path) ? 'archive-menu-active' : '',
      command: () => (this.drawerOpen = false),
    }));
  }

  constructor() {
    this.updateDrawerPosition();
    if (typeof localStorage !== 'undefined') {
      const storedTheme = localStorage.getItem('archive-theme');
      this.theme =
        storedTheme === 'dark-blue'
          ? 'dark-blue'
          : storedTheme === 'dark' || storedTheme === 'dark-grey'
            ? 'dark'
            : 'light';
    }
    this.applyTheme();
  }

  @HostListener('window:resize')
  public updateDrawerPosition() {
    this.drawerPosition = (this.document.defaultView?.innerWidth ?? 1024) < 1024 ? 'top' : 'left';
  }

  private applyTheme() {
    this.document.documentElement.classList.toggle('dark', this.theme !== 'light');
    this.document.documentElement.setAttribute('data-theme', this.theme === 'light' ? 'light' : 'dark');
    usePreset(
      this.theme === 'light'
        ? archiveLightPreset
        : this.theme === 'dark'
          ? archiveGreyPreset
          : archiveBluePreset,
    );
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
