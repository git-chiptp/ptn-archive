import { Injectable, signal } from '@angular/core';

export type LanguageCode = 'en' | 'vi' | 'ja' | 'zh' | 'ko';
export interface LanguageOption { code: LanguageCode; label: string; nativeLabel: string; }

type UiKey = 'mainStory' | 'events' | 'interrogation' | 'admin';
const UI_LABELS: Record<LanguageCode, Partial<Record<UiKey, string>>> = {
  en: { mainStory: 'Main story', events: 'Events', interrogation: 'Interrogation', admin: 'Admin' },
  vi: { mainStory: 'Cốt truyện chính', events: 'Sự kiện', interrogation: 'Thẩm vấn', admin: 'Quản trị' },
  ja: { mainStory: 'メインストーリー', events: 'イベント', interrogation: '尋問', admin: '管理' },
  zh: { mainStory: '主线故事', events: '事件', interrogation: '审讯', admin: '管理' },
  ko: { mainStory: '메인 스토리', events: '이벤트', interrogation: '심문', admin: '관리' },
};

@Injectable({ providedIn: 'root' })
export class LanguageService {
  // Only English and Vietnamese are selectable until those translations exist.
  readonly supportedLanguages: LanguageOption[] = [
    { code: 'en', label: 'English', nativeLabel: 'English' },
    { code: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt' },
  ];
  readonly current = signal<LanguageCode>(this.readInitialLanguage());
  setLanguage(language: LanguageCode) {
    this.current.set(language);
    if (typeof localStorage !== 'undefined') localStorage.setItem('archive-language', language);
  }
  text(key: UiKey): string { return UI_LABELS[this.current()][key] ?? UI_LABELS.en[key] ?? key; }
  private readInitialLanguage(): LanguageCode {
    if (typeof localStorage === 'undefined') return 'en';
    const stored = localStorage.getItem('archive-language') as LanguageCode | null;
    return stored && this.supportedLanguages.some((item) => item.code === stored) ? stored : 'en';
  }
}
