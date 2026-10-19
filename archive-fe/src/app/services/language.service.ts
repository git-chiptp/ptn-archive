import { Injectable, signal } from '@angular/core';
import en from '../i18n/en.json';
import vi from '../i18n/vi.json';
export type LanguageCode = string;
export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
}
type UiDictionary = Record<string, string>;
type UiKey = keyof typeof en;
const UI_LABELS: Record<string, UiDictionary> = { en, vi };
@Injectable({ providedIn: 'root' })
export class LanguageService {
  public readonly supportedLanguages: LanguageOption[] = [
    { code: 'en', label: 'English', nativeLabel: 'English' },
    { code: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt' },
  ];
  public readonly current = signal<LanguageCode>(this.readInitialLanguage());

  public setLanguage(language: LanguageCode) {
    if (!this.supportedLanguages.some((item) => item.code === language)) {
      return;
    }
    this.current.set(language);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('archive-language', language);
    }
  }
  public text(key: UiKey | string, params: Record<string, string> = {}): string {
    const value = UI_LABELS[this.current()]?.[key] ?? UI_LABELS['en'][key] ?? key;
    return Object.entries(params).reduce(
      (text, [name, replacement]) => text.replaceAll(`{${name}}`, replacement),
      value,
    );
  }
  private readInitialLanguage(): LanguageCode {
    if (typeof localStorage === 'undefined') {
      return 'en';
    }
    const stored = localStorage.getItem('archive-language');
    return stored && this.supportedLanguages.some((item) => item.code === stored) ? stored : 'en';
  }
}
