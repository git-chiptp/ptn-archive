import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
  Collection,
  Chapter,
  Gender,
  Transcript,
  Category,
  DialogueNode,
  TranscriptTranslation,
} from '../models/transcript.models';
import { LanguageCode } from './language.service';

type ApiArchive = {
  id: string;
  title: string;
  description?: string;
  transcriptText?: string;
  category?: string;
  parentId?: string;
  parentLabel?: string;
  stageLabel?: string;
  sourceLanguage?: string;
};
type ApiTranslation = {
  languageCode: string;
  title: string;
  description?: string;
  transcriptText?: string;
  parentLabel?: string;
  stageLabel?: string;
};
type ApiChapter = { id: string; name: string; backgroundImage?: string; category?: string };

@Injectable({ providedIn: 'root' })
export class ArchiveStore {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = 'http://localhost:8080/api/archives';

  private readonly chapterUrl = 'http://localhost:8080/api/chapters';

  public readonly gender = signal<Gender>('female');

  public readonly transcripts = signal<Transcript[]>([]);

  public readonly chapters = signal<Chapter[]>([]);

  public readonly loading = signal(true);

  public readonly error = signal<string | null>(null);

  public readonly statusMessage = signal<string | null>(null);
  constructor() {
    this.load();
    this.loadChapters();
  }
  public setGender(gender: Gender) {
    this.gender.set(gender);
  }
  public load() {
    this.http.get<ApiArchive[]>(this.apiUrl).subscribe({
      next: (items) => {
        this.transcripts.set(items.map((item) => this.fromApi(item)));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not connect to backend on port 8080.');
        this.loading.set(false);
      },
    });
  }
  public loadChapters() {
    this.http.get<ApiChapter[]>(this.chapterUrl).subscribe({
      next: (items) =>
        this.chapters.set(
          items.map((item) => ({
            id: item.id,
            name: item.name,
            backgroundImage: item.backgroundImage,
            category: this.categoryFromApi(item.category),
          })),
        ),
      error: () => this.error.set('Could not load chapters.'),
    });
  }
  public addChapter(chapter: Chapter) {
    this.http
      .post<ApiChapter>(this.chapterUrl, {
        name: chapter.name,
        backgroundImage: chapter.backgroundImage ?? null,
        category: (chapter.category ?? 'main-story').replace('-', '_').toUpperCase(),
      })
      .subscribe({
        next: (saved) =>
          this.chapters.update((items) => [
            ...items,
            {
              id: saved.id,
              name: saved.name,
              backgroundImage: saved.backgroundImage,
              category: this.categoryFromApi(saved.category),
            },
          ]),
        error: () => this.error.set('Could not save chapter.'),
      });
  }
  public updateChapter(chapter: Chapter) {
    this.http
      .put<ApiChapter>(this.chapterUrl + '/' + chapter.id, {
        name: chapter.name,
        backgroundImage: chapter.backgroundImage ?? null,
        category: (chapter.category ?? 'main-story').replace('-', '_').toUpperCase(),
      })
      .subscribe({
        next: (saved) =>
          this.chapters.update((items) =>
            items.map((item) =>
              item.id === chapter.id
                ? {
                    id: saved.id,
                    name: saved.name,
                    backgroundImage: saved.backgroundImage,
                    category: this.categoryFromApi(saved.category),
                  }
                : item,
            ),
          ),
        error: () => this.error.set('Could not update chapter.'),
      });
  }
  public removeChapter(id: string) {
    this.http.delete<void>(this.chapterUrl + '/' + id).subscribe({
      next: () => this.chapters.update((items) => items.filter((item) => item.id !== id)),
      error: () => this.error.set('Could not delete chapter.'),
    });
  }
  public loadTranslations(id: string, onLoaded?: () => void) {
    this.http.get<ApiTranslation[]>(this.apiUrl + '/' + id + '/translations').subscribe({
      next: (items) => {
        this.transcripts.update((records) =>
          records.map((record) =>
            record.id === id
              ? {
                  ...record,
                  translations: Object.fromEntries(
                    items.map((item) => [item.languageCode, this.translationFromApi(item)]),
                  ),
                }
              : record,
          ),
        );
        onLoaded?.();
      },
    });
  }
  public saveTranslation(id: string, language: LanguageCode, translation: TranscriptTranslation) {
    this.statusMessage.set(null);
    this.http
      .put<ApiTranslation>(this.apiUrl + '/' + id + '/translations/' + language, {
        languageCode: language,
        title: translation.title,
        parentLabel: translation.parentLabel,
        stageLabel: translation.stageLabel ?? '',
        description: translation.description ?? '',
        transcriptText: JSON.stringify(translation.nodes ?? []),
        translationStatus: 'PUBLISHED',
        translationSource: 'HUMAN',
      })
      .subscribe({
        next: () => {
          this.statusMessage.set('Translation saved successfully.');
          this.loadTranslations(id);
        },
        error: () => this.statusMessage.set('Could not save translation. Please try again.'),
      });
  }
  public add(transcript: Transcript) {
    this.statusMessage.set(null);
    this.http.post<ApiArchive>(this.apiUrl, this.toRequest(transcript)).subscribe({
      next: (saved) => {
        this.transcripts.update((items) => [...items, this.fromApi(saved)]);
        this.statusMessage.set('Transcript saved successfully.');
      },
      error: () => this.statusMessage.set('Could not save transcript. Please try again.'),
    });
  }
  public update(transcript: Transcript) {
    this.statusMessage.set(null);
    this.http
      .put<ApiArchive>(this.apiUrl + '/' + transcript.id, this.toRequest(transcript))
      .subscribe({
        next: (saved) => {
          this.transcripts.update((items) =>
            items.map((item) => (item.id === transcript.id ? this.fromApi(saved) : item)),
          );
          this.statusMessage.set('Transcript saved successfully.');
        },
        error: () => this.statusMessage.set('Could not save transcript. Please try again.'),
      });
  }
  public remove(id: string) {
    this.http.delete<void>(this.apiUrl + '/' + id).subscribe({
      next: () => this.transcripts.update((items) => items.filter((item) => item.id !== id)),
      error: () => this.error.set('Could not delete transcript.'),
    });
  }
  public collections(category: string): Collection[] {
    const groups = new Map<string, Collection>();
    if (category === 'main-story' || category === 'event-story') {
      this.chapters()
        .filter((chapter) => (chapter.category ?? 'main-story') === category)
        .forEach((chapter) =>
          groups.set(chapter.id, {
            id: chapter.id,
            label: chapter.name,
            category: category as Category,
            backgroundImage: chapter.backgroundImage,
            stages: [],
          }),
        );
    }
    this.transcripts()
      .filter((t) => t.category === category)
      .forEach((t) => {
        const matchingChapter =
          category === 'main-story' || category === 'event-story'
            ? [...groups.values()].find(
                (group) => group.id === t.parentId || group.label === t.parentLabel,
              )
            : undefined;
        const id = matchingChapter?.id ?? t.parentId;
        const group = groups.get(id) ?? {
          id,
          label: t.parentLabel,
          category: t.category,
          stages: [],
        };
        group.stages.push({ id: t.id, label: t.stageLabel });
        groups.set(id, group);
      });
    return [...groups.values()];
  }
  private categoryFromApi(value?: string): Category {
    return (value ?? 'MAIN_STORY').toLowerCase().replace('_', '-') as Category;
  }
  private fromApi(item: ApiArchive): Transcript {
    return {
      id: item.id,
      title: item.title,
      description: item.description ?? '',
      category: (item.category ?? 'MAIN_STORY').toLowerCase().replace('_', '-') as Category,
      parentId: item.parentId ?? item.id,
      parentLabel: item.parentLabel ?? item.title,
      stageLabel: item.stageLabel ?? item.title,
      sourceLanguage: (item.sourceLanguage ?? 'en') as LanguageCode,
      nodes: this.parseNodes(item.transcriptText),
    };
  }
  private translationFromApi(item: ApiTranslation): TranscriptTranslation {
    return {
      title: item.title,
      description: item.description,
      parentLabel: item.parentLabel,
      stageLabel: item.stageLabel,
      nodes: this.parseNodes(item.transcriptText),
    };
  }
  private parseNodes(value?: string): DialogueNode[] {
    if (!value) {
      return [];
    }
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value ? [{ type: 'line', id: crypto.randomUUID(), text: value }] : [];
    }
  }
  private toRequest(transcript: Transcript) {
    return {
      title: transcript.title,
      sourceLanguage: transcript.sourceLanguage ?? 'en',
      description: transcript.description,
      transcriptText: JSON.stringify(transcript.nodes),
      status: 'PUBLISHED',
      category: transcript.category.replace('-', '_').toUpperCase(),
      parentId: transcript.parentId,
      parentLabel: transcript.parentLabel,
      stageLabel: transcript.stageLabel,
    };
  }
}
