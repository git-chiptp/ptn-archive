import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
export type LanguageCode = string;
export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
}
type UiKey = 'mainStory' | 'events' | 'interrogation' | 'admin';
const UI_LABELS: Record<string, Partial<Record<UiKey, string>>> = {
  en: {
    mainStory: 'Main story',
    events: 'Events',
    interrogation: 'Interrogation',
    admin: 'Add transcript',
  },
  vi: {
    mainStory: 'Cốt truyện chính',
    events: 'Sự kiện',
    interrogation: 'Thẩm vấn',
    admin: 'Thêm bản chép lời',
  },
};
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly http = inject(HttpClient);

  public readonly supportedLanguages: LanguageOption[] = [
    { code: 'en', label: 'English', nativeLabel: 'English' },
    { code: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt' },
  ];
  public readonly current = signal<LanguageCode>(this.readInitialLanguage());

  constructor() {
    this.http.get<LanguageOption[]>('http://localhost:8080/api/languages').subscribe({
      next: (languages) => {
        if (languages.length) {
          this.supportedLanguages.splice(0, this.supportedLanguages.length, ...languages);
          if (!this.supportedLanguages.some((language) => language.code === this.current())) {
            this.current.set('en');
          }
        }
      },
    });
  }
  public setLanguage(language: LanguageCode) {
    if (!this.supportedLanguages.some((item) => item.code === language)) {
      return;
    }
    this.current.set(language);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('archive-language', language);
    }
  }
  public text(key: UiKey): string {
    return UI_LABELS[this.current()]?.[key] ?? UI_LABELS['en'][key] ?? key;
  }
  private readInitialLanguage(): LanguageCode {
    if (typeof localStorage === 'undefined') {
      return 'en';
    }
    const stored = localStorage.getItem('archive-language');
    return stored && this.supportedLanguages.some((item) => item.code === stored) ? stored : 'en';
  }
}
