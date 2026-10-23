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
import { SUPABASE_CLIENT } from './supabase.client';
import { ArchiveStorageService } from './archive-storage.service';

type ApiArchive = {
  id: string;
  title: string;
  description?: string;
  transcriptText?: DialogueNode[];
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
  transcriptText?: DialogueNode[];
  parentLabel?: string;
  stageLabel?: string;
};
type ApiChapter = { id: string; name: string; backgroundImage?: string; category?: string };
export type TranscriptSearchResult = {
  archive_id: string;
  language_code: string | null;
  title: string;
  parent_label: string | null;
  stage_label: string | null;
  rank: number;
  snippet: string;
};
type ChapterRow = {
  id: string;
  name: string;
  background_image: string | null;
  category: string;
};
type ArchiveRow = {
  id: string;
  title: string;
  description: string | null;
  transcript_text?: DialogueNode[] | null;
  category: string;
  parent_id: string | null;
  parent_label: string | null;
  stage_label: string | null;
  source_language: string;
};
type TranslationRow = {
  language_code: string;
  title: string;
  description: string | null;
  transcript_text: DialogueNode[] | null;
  parent_label: string | null;
  stage_label: string | null;
};

@Injectable({ providedIn: 'root' })
export class ArchiveStore {
  private readonly supabase = inject(SUPABASE_CLIENT);

  private readonly storage = inject(ArchiveStorageService);

  private readonly loadedTranscriptIds = new Set<string>();

  private readonly pendingTranscriptIds = new Set<string>();

  public readonly gender = signal<Gender>('female');

  public readonly transcripts = signal<Transcript[]>([]);

  public readonly chapters = signal<Chapter[]>([]);

  public readonly loading = signal(true);

  public readonly transcriptLoading = signal<string | null>(null);

  public readonly transcriptUnavailable = signal<string | null>(null);

  public readonly error = signal<string | null>(null);

  public readonly statusMessage = signal<string | null>(null);

  constructor() {
    this.load();
    this.loadChapters();
  }
  public setGender(gender: Gender) {
    this.gender.set(gender);
  }

  public clearStatusMessage() {
    this.statusMessage.set(null);
  }
  public async load() {
    this.loading.set(true);
    this.error.set(null);
    const rows: ArchiveRow[] = [];
    const pageSize = 500;
    try {
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await this.supabase
          .from('archives')
          .select(
            'id,title,description,category,parent_id,parent_label,stage_label,source_language',
          )
          .eq('status', 'PUBLISHED')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        rows.push(...(data as ArchiveRow[]));
        if (!data || data.length < pageSize) break;
      }
      const previous = new Map(this.transcripts().map((item) => [item.id, item]));
      this.transcripts.set(
        rows.map((row) => {
          const cached = previous.get(row.id);
          return {
            ...this.fromApi(this.archiveFromRow(row)),
            nodes: cached?.nodes ?? [],
            translations: cached?.translations,
          };
        }),
      );
    } catch {
      this.error.set('Could not load transcripts from Supabase.');
    } finally {
      this.loading.set(false);
    }
  }
  public async loadChapters() {
    try {
      const { data, error } = await this.supabase
        .from('chapters')
        .select('id,name,background_image,category')
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as ChapterRow[];
      await this.storage
        .resolveMediaReferences(rows.map((item) => item.background_image))
        .catch(() => this.error.set('Could not load chapter images.'));
      this.chapters.set(rows.map((item) => this.chapterFromRow(item)));
    } catch {
      this.error.set('Could not load chapters from Supabase.');
    }
  }
  public async loadTranscript(id: string) {
    if (this.loadedTranscriptIds.has(id) || this.pendingTranscriptIds.has(id)) return;
    this.pendingTranscriptIds.add(id);
    this.transcriptUnavailable.set(null);
    this.transcriptLoading.set(id);
    try {
      const { data, error } = await this.supabase
        .from('archives')
        .select('transcript_text')
        .eq('id', id)
        .eq('status', 'PUBLISHED')
        .single();
      if (error) throw error;
      const nodes = this.parseNodes(data.transcript_text ?? undefined);
      await this.storage
        .resolveMediaReferences(this.storage.mediaReferences(nodes))
        .catch(() => this.error.set('Could not load transcript images.'));
      this.transcripts.update((records) =>
        records.map((record) =>
          record.id === id ? { ...record, nodes: this.storage.toPublicNodes(nodes) } : record,
        ),
      );
      this.loadedTranscriptIds.add(id);
    } catch {
      this.transcriptUnavailable.set(id);
      this.error.set('Could not load transcript from Supabase.');
    } finally {
      this.pendingTranscriptIds.delete(id);
      if (this.transcriptLoading() === id) this.transcriptLoading.set(null);
    }
  }
  public async addChapter(chapter: Chapter, onSuccess?: () => void, onError?: () => void) {
    const chapterId = chapter.id || crypto.randomUUID();
    try {
      const backgroundPath = this.storage.toStoredValue(chapter.backgroundImage);
      const { data, error } = await this.supabase
        .from('chapters')
        .insert({
          id: chapterId,
          name: chapter.name,
          background_image: backgroundPath ?? chapter.backgroundImage ?? null,
          category: this.categoryToApi(chapter.category),
        })
        .select('id,name,background_image,category')
        .single();
      if (error) throw error;
      const saved = data as ChapterRow;
      await this.storage.resolveMediaReferences([saved.background_image]).catch(() => undefined);
      this.chapters.update((items) => [...items, this.chapterFromRow(saved)]);
      onSuccess?.();
    } catch {
      this.error.set('Could not save chapter.');
      onError?.();
    }
  }
  public async updateChapter(chapter: Chapter, onSuccess?: () => void, onError?: () => void) {
    const previous = this.chapters().find((item) => item.id === chapter.id);
    const previousPath = this.storage.toLegacyStoragePath(previous?.backgroundImage);
    let backgroundPath: string | undefined;
    try {
      backgroundPath = this.storage.toStoredValue(chapter.backgroundImage);
      const { data, error } = await this.supabase
        .from('chapters')
        .update({
          name: chapter.name,
          background_image: backgroundPath ?? chapter.backgroundImage ?? null,
          category: this.categoryToApi(chapter.category),
        })
        .eq('id', chapter.id)
        .select('id,name,background_image,category')
        .single();
      if (error) throw error;
      const saved = data as ChapterRow;
      await this.storage.resolveMediaReferences([saved.background_image]).catch(() => undefined);
      this.chapters.update((items) =>
        items.map((item) => (item.id === chapter.id ? this.chapterFromRow(saved) : item)),
      );
      if (previousPath && previousPath !== backgroundPath) {
        void this.storage.removePaths([previousPath]).catch(() => undefined);
      }
      onSuccess?.();
    } catch {
      this.error.set('Could not update chapter.');
      onError?.();
    }
  }
  public async removeChapter(id: string, onSuccess?: () => void) {
    try {
      const { error } = await this.supabase.from('chapters').delete().eq('id', id);
      if (error) throw error;
      this.chapters.update((items) => items.filter((item) => item.id !== id));
      void this.storage.removeOwnerAssets(`chapters/${id}`).catch(() => undefined);
      onSuccess?.();
    } catch {
      this.error.set('Could not delete chapter.');
    }
  }
  public async searchTranscripts(
    query: string,
    resultLimit = 50,
  ): Promise<TranscriptSearchResult[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [];
    }
    const { data, error } = await this.supabase.rpc('search_transcripts', {
      query: normalizedQuery,
      result_limit: resultLimit,
    });
    if (error) {
      this.error.set('Could not search transcripts in Supabase.');
      return [];
    }
    return (data ?? []) as TranscriptSearchResult[];
  }

  public async loadTranslations(id: string, onLoaded?: () => void) {
    const { data, error } = await this.supabase
      .from('archive_translations')
      .select('language_code,title,description,transcript_text,parent_label,stage_label')
      .eq('archive_id', id)
      .eq('translation_status', 'PUBLISHED');
    if (error) {
      this.error.set('Could not load translations from Supabase.');
      return;
    }
    const rows = (data ?? []) as TranslationRow[];
    await this.storage
      .resolveMediaReferences(
        rows.flatMap((item) => this.storage.mediaReferences(this.parseNodes(item.transcript_text))),
      )
      .catch(() => this.error.set('Could not load translation images.'));
    this.transcripts.update((records) =>
      records.map((record) =>
        record.id === id
          ? {
              ...record,
              translations: Object.fromEntries(
                rows.map((item) => [
                  item.language_code,
                  this.translationFromApi({
                    languageCode: item.language_code,
                    title: item.title,
                    description: item.description ?? undefined,
                    transcriptText: item.transcript_text ?? undefined,
                    parentLabel: item.parent_label ?? undefined,
                    stageLabel: item.stage_label ?? undefined,
                  }),
                ]),
              ),
            }
          : record,
      ),
    );
    onLoaded?.();
  }
  public saveTranslation(
    id: string,
    language: LanguageCode,
    translation: TranscriptTranslation,
    onSuccess?: () => void,
    onError?: () => void,
  ) {
    this.statusMessage.set(null);
    const previous = this.transcripts().find((record) => record.id === id)?.translations?.[
      language
    ];
    const previousPaths = previous ? this.storage.collectPaths(previous.nodes ?? []) : [];
    this.supabase
      .from('archive_translations')
      .upsert(
        {
          archive_id: id,
          language_code: language.toLowerCase(),
          title: translation.title ?? '',
          parent_label: translation.parentLabel ?? null,
          stage_label: translation.stageLabel ?? null,
          description: translation.description ?? null,
          transcript_text: this.storage.toStorageNodes(translation.nodes ?? []),
          translation_status: 'PUBLISHED',
        },
        { onConflict: 'archive_id,language_code' },
      )
      .select('language_code,title,description,transcript_text,parent_label,stage_label')
      .single()
      .then(async ({ data, error }) => {
        if (error) throw error;
        const saved = data as TranslationRow;
        await this.storage
          .resolveMediaReferences(
            this.storage.mediaReferences(this.parseNodes(saved.transcript_text)),
          )
          .catch(() => undefined);
        const savedTranslation = this.translationFromApi({
          languageCode: saved.language_code,
          title: saved.title,
          description: saved.description ?? undefined,
          transcriptText: saved.transcript_text ?? undefined,
          parentLabel: saved.parent_label ?? undefined,
          stageLabel: saved.stage_label ?? undefined,
        });
        this.transcripts.update((records) =>
          records.map((record) =>
            record.id === id
              ? {
                  ...record,
                  translations: { ...record.translations, [language]: savedTranslation },
                }
              : record,
          ),
        );
        const nextPaths = this.storage.collectPaths(savedTranslation.nodes ?? []);
        void this.storage
          .removePaths(previousPaths.filter((path) => !nextPaths.includes(path)))
          .catch(() => undefined);
        this.statusMessage.set('Translation saved successfully.');
        onSuccess?.();
      })
      .then(undefined, () => {
        const nextPaths = this.storage.collectPaths(translation.nodes ?? []);
        void this.storage
          .removePaths(nextPaths.filter((path) => !previousPaths.includes(path)))
          .catch(() => undefined);
        this.statusMessage.set('Could not save translation. Please try again.');
        onError?.();
      });
  }
  public add(transcript: Transcript, onSuccess?: (saved: Transcript) => void) {
    this.statusMessage.set(null);
    const nextPaths = this.storage.collectPaths(transcript.nodes);
    this.supabase
      .from('archives')
      .insert(this.toRow(transcript))
      .select(
        'id,title,description,category,parent_id,parent_label,stage_label,source_language,transcript_text',
      )
      .single()
      .then(async ({ data, error }) => {
        if (error) throw error;
        await this.storage
          .resolveMediaReferences(
            this.storage.mediaReferences(this.parseNodes((data as ArchiveRow).transcript_text)),
          )
          .catch(() => undefined);
        const created = this.fromRow(data as ArchiveRow);
        this.transcripts.update((items) => [...items, created]);
        this.statusMessage.set('Transcript saved successfully.');
        onSuccess?.(created);
      })
      .then(undefined, () => {
        void this.storage.removePaths(nextPaths).catch(() => undefined);
        this.statusMessage.set('Could not save transcript. Please try again.');
      });
  }
  public update(
    transcript: Transcript,
    onSuccess?: (saved: Transcript) => void,
    onError?: () => void,
  ) {
    this.statusMessage.set(null);
    const previous = this.transcripts().find((item) => item.id === transcript.id);
    const previousPaths = previous ? this.storage.collectPaths(previous.nodes) : [];
    const nextPaths = this.storage.collectPaths(transcript.nodes);
    this.supabase
      .from('archives')
      .update(this.toRow(transcript))
      .eq('id', transcript.id)
      .select(
        'id,title,description,category,parent_id,parent_label,stage_label,source_language,transcript_text',
      )
      .single()
      .then(async ({ data, error }) => {
        if (error) throw error;
        await this.storage
          .resolveMediaReferences(
            this.storage.mediaReferences(this.parseNodes((data as ArchiveRow).transcript_text)),
          )
          .catch(() => undefined);
        const saved = this.fromRow(data as ArchiveRow);
        const updated = { ...saved, translations: transcript.translations };
        this.transcripts.update((items) =>
          items.map((item) => (item.id === transcript.id ? updated : item)),
        );
        this.loadedTranscriptIds.add(transcript.id);
        const nextPaths = this.storage.collectPaths(saved.nodes);
        void this.storage
          .removePaths(previousPaths.filter((path) => !nextPaths.includes(path)))
          .catch(() => undefined);
        this.statusMessage.set('Transcript saved successfully.');
        onSuccess?.(updated);
      })
      .then(undefined, () => {
        void this.storage
          .removePaths(nextPaths.filter((path) => !previousPaths.includes(path)))
          .catch(() => undefined);
        this.statusMessage.set('Could not save transcript. Please try again.');
        onError?.();
      });
  }
  public remove(id: string, onSuccess?: () => void, onError?: () => void) {
    this.statusMessage.set(null);
    this.supabase
      .from('archives')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) throw error;
        this.transcripts.update((items) => items.filter((item) => item.id !== id));
        this.loadedTranscriptIds.delete(id);
        void this.storage.removeOwnerAssets(`archives/${id}`).catch(() => undefined);
        onSuccess?.();
      })
      .then(undefined, () => {
        this.statusMessage.set('Could not delete transcript. Please try again.');
        onError?.();
      });
  }
  public collections(category: string): Collection[] {
    const groups = new Map<string, Collection>();
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
    this.transcripts()
      .filter((t) => t.category === category)
      .forEach((t) => {
        const matchingChapter = [...groups.values()].find(
          (group) => group.id === t.parentId || group.label === t.parentLabel,
        );
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
  private archiveFromRow(item: ArchiveRow): ApiArchive {
    return {
      id: item.id,
      title: item.title,
      description: item.description ?? undefined,
      transcriptText: item.transcript_text ?? undefined,
      category: item.category,
      parentId: item.parent_id ?? undefined,
      parentLabel: item.parent_label ?? undefined,
      stageLabel: item.stage_label ?? undefined,
      sourceLanguage: item.source_language,
    };
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
      nodes: this.storage.toPublicNodes(this.parseNodes(item.transcriptText)),
    };
  }
  private fromRow(item: ArchiveRow): Transcript {
    return this.fromApi(this.archiveFromRow(item));
  }
  private chapterFromRow(item: ChapterRow): Chapter {
    return {
      id: item.id,
      name: item.name,
      backgroundImage: this.storage.toPublicUrl(item.background_image),
      category: this.categoryFromApi(item.category),
    };
  }
  private translationFromApi(item: ApiTranslation): TranscriptTranslation {
    return {
      title: item.title,
      description: item.description,
      parentLabel: item.parentLabel,
      stageLabel: item.stageLabel,
      nodes: this.storage.toPublicNodes(this.parseNodes(item.transcriptText)),
    };
  }
  private parseNodes(value?: DialogueNode[] | string | null): DialogueNode[] {
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [{ type: 'line', id: crypto.randomUUID(), text: value }];
    }
  }
  private toRow(transcript: Transcript) {
    return {
      id: transcript.id,
      title: transcript.title,
      source_language: transcript.sourceLanguage ?? 'en',
      description: transcript.description,
      transcript_text: this.storage.toStorageNodes(transcript.nodes),
      status: 'PUBLISHED',
      category: transcript.category.replace('-', '_').toUpperCase(),
      parent_id: transcript.parentId,
      parent_label: transcript.parentLabel,
      stage_label: transcript.stageLabel,
    };
  }
  private categoryToApi(value?: Category): string {
    return (value ?? 'main-story').replace('-', '_').toUpperCase();
  }
}
