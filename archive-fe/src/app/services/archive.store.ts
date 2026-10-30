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
import { LanguageCode, LanguageService } from './language.service';
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
  name_translations: Record<string, string> | null;
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
type TranslationMetadataRow = {
  archive_id: string;
  language_code: string;
  title: string;
  parent_label: string | null;
  stage_label: string | null;
};

@Injectable({ providedIn: 'root' })
export class ArchiveStore {
  private readonly supabase = inject(SUPABASE_CLIENT);

  private readonly storage = inject(ArchiveStorageService);

  private readonly language = inject(LanguageService);

  private readonly loadedTranscriptIds = new Set<string>();

  private readonly pendingTranscriptIds = new Set<string>();

  private readonly loadedTranslationIds = new Set<string>();

  private readonly pendingTranslationLoads = new Map<string, Promise<boolean>>();

  private readonly loadedCategories = new Set<Category>();

  private readonly pendingCategoryLoads = new Map<Category, Promise<void>>();

  private readonly loadedCollections = new Set<string>();

  private readonly pendingCollectionLoads = new Map<string, Promise<void>>();

  public readonly gender = signal<Gender>(this.readStoredGender());

  public readonly transcripts = signal<Transcript[]>([]);

  public readonly chapters = signal<Chapter[]>([]);

  public readonly selectedChapter = signal<Chapter | null>(null);

  public readonly loading = signal(false);

  public readonly transcriptLoading = signal<string | null>(null);

  public readonly transcriptUnavailable = signal<string | null>(null);

  public readonly error = signal<string | null>(null);

  public readonly statusMessage = signal<string | null>(null);

  public setGender(gender: Gender) {
    this.gender.set(gender);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('archive-gender', gender);
    }
  }

  private readStoredGender(): Gender {
    if (typeof localStorage === 'undefined') {
      return 'female';
    }
    const stored = localStorage.getItem('archive-gender');
    return stored === 'male' || stored === 'female' ? stored : 'female';
  }

  public clearStatusMessage() {
    this.statusMessage.set(null);
  }

  public async ensureCategoryLoaded(category: Category): Promise<void> {
    if (this.loadedCategories.has(category)) return;
    const pending = this.pendingCategoryLoads.get(category);
    if (pending) return pending;

    this.error.set(null);
    this.loading.set(true);
    const request = this.loadCategoryChapters(category)
      .then(() => {
        this.loadedCategories.add(category);
      })
      .catch(() => this.error.set('Could not load archive data from Supabase.'))
      .finally(() => {
        this.loading.set(false);
        this.pendingCategoryLoads.delete(category);
      });
    this.pendingCategoryLoads.set(category, request);
    return request;
  }

  public async ensureCollectionLoadedBySlug(category: Category, parentSlug: string): Promise<void> {
    await this.ensureCategoryLoaded(category);
    const selected = this.selectedChapter();
    const chapter = selected?.category === category && this.slug(selected.name) === parentSlug
      ? selected
      : this.chapters().find(
          (item) => item.category === category && this.slug(item.name) === parentSlug,
        );
    if (!chapter) {
      return;
    }
    this.selectedChapter.set(chapter);
    await this.loadCollection(category, chapter.id, chapter.name);
  }

  public selectChapter(category: Category, label: string) {
    const chapter = this.chapters().find(
      (item) => item.category === category && item.name === label,
    );
    if (chapter) this.selectedChapter.set(chapter);
  }

  public async ensureCollectionLoaded(
    category: Category,
    parentId: string,
    parentLabel: string,
  ): Promise<void> {
    await this.ensureCategoryLoaded(category);
    this.selectedChapter.set(this.chapters().find((chapter) => chapter.id === parentId) ?? null);
    await this.loadCollection(category, parentId, parentLabel);
  }

  private async loadCollection(
    category: Category,
    parentId: string,
    parentLabel: string,
  ): Promise<void> {
    const key = `${category}:${parentId || parentLabel}`;
    if (this.loadedCollections.has(key)) return;
    const pending = this.pendingCollectionLoads.get(key);
    if (pending) return pending;

    this.error.set(null);
    this.loading.set(true);
    const request = this.loadCollectionTranscripts(category, parentId, parentLabel)
      .then(() => {
        this.loadedCollections.add(key);
      })
      .catch(() => this.error.set('Could not load archive data from Supabase.'))
      .finally(() => {
        this.loading.set(false);
        this.pendingCollectionLoads.delete(key);
      });
    this.pendingCollectionLoads.set(key, request);
    return request;
  }

  private async loadCollectionTranscripts(category: Category, parentId: string, parentLabel: string) {
    const rows: ArchiveRow[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      let query = this.supabase
        .from('archives')
        .select(
          'id,title,description,category,parent_id,parent_label,stage_label,source_language',
        )
        .eq('status', 'PUBLISHED')
        .eq('category', this.categoryToApi(category));
      query = parentId ? query.eq('parent_id', parentId) : query.eq('parent_label', parentLabel);
      const { data, error } = await query
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      rows.push(...(data as ArchiveRow[]));
      if (!data || data.length < pageSize) break;
    }

    const previous = new Map(this.transcripts().map((item) => [item.id, item]));
    const records = rows.map((row) => {
      const cached = previous.get(row.id);
      return {
        ...this.fromApi(this.archiveFromRow(row)),
        nodes: cached?.nodes ?? [],
        translations: cached?.translations,
      };
    });
    this.transcripts.update((items) => [
      ...items.filter((item) => !this.matchesCollection(item, category, parentId, parentLabel)),
      ...records,
    ]);
    await this.loadTranslationMetadata(rows.map((row) => row.id));
  }

  private async loadCategoryChapters(category: Category) {
    const { data, error } = await this.supabase
      .from('chapters')
      .select('id,name,name_translations,background_image,category')
      .eq('category', this.categoryToApi(category))
      .order('created_at', { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as ChapterRow[];
    this.chapters.update((items) => [
      ...items.filter((item) => item.category !== category),
      ...rows.map((item) => this.chapterFromRow(item)),
    ]);
    await this.storage
      .resolveMediaReferences(rows.map((item) => item.background_image))
      .then(() => {
        this.chapters.update((items) => [
          ...items.filter((item) => item.category !== category),
          ...rows.map((item) => this.chapterFromRow(item)),
        ]);
      })
      .catch(() => this.error.set('Could not load chapter images.'));
  }

  private matchesCollection(
    transcript: Transcript,
    category: Category,
    parentId: string,
    parentLabel: string,
  ): boolean {
    return (
      transcript.category === category &&
      (parentId ? transcript.parentId === parentId : transcript.parentLabel === parentLabel)
    );
  }

  private slug(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async loadTranslationMetadata(archiveIds: string[]) {
    if (!archiveIds.length) {
      return;
    }
    const { data, error } = await this.supabase
      .from('archive_translations')
      .select('archive_id,language_code,title,parent_label,stage_label')
      .eq('translation_status', 'PUBLISHED')
      .in('archive_id', archiveIds);
    if (error) {
      return;
    }
    const rows = (data ?? []) as TranslationMetadataRow[];
    const metadataByTranscript = new Map<string, TranslationMetadataRow[]>();
    rows.forEach((row) => {
      const translations = metadataByTranscript.get(row.archive_id) ?? [];
      translations.push(row);
      metadataByTranscript.set(row.archive_id, translations);
    });
    this.transcripts.update((records) =>
      records.map((record) => {
        const translations = metadataByTranscript.get(record.id);
        if (!translations) return record;
        return {
          ...record,
          translations: {
            ...record.translations,
            ...Object.fromEntries(
              translations.map((row) => [
                row.language_code.trim().toLowerCase(),
                {
                  ...record.translations?.[row.language_code.trim().toLowerCase()],
                  title: row.title,
                  parentLabel: row.parent_label ?? undefined,
                  stageLabel: row.stage_label ?? undefined,
                },
              ]),
            ),
          },
        };
      }),
    );
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
          name_translations: chapter.nameTranslations ?? {},
          background_image: backgroundPath ?? chapter.backgroundImage ?? null,
          category: this.categoryToApi(chapter.category),
        })
        .select('id,name,name_translations,background_image,category')
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
          name_translations: chapter.nameTranslations ?? {},
          background_image: backgroundPath ?? chapter.backgroundImage ?? null,
          category: this.categoryToApi(chapter.category),
        })
        .eq('id', chapter.id)
        .select('id,name,name_translations,background_image,category')
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
    if (this.loadedTranslationIds.has(id)) {
      onLoaded?.();
      return;
    }

    let request = this.pendingTranslationLoads.get(id);
    if (!request) {
      request = (async () => {
        const { data, error } = await this.supabase
          .from('archive_translations')
          .select('language_code,title,description,transcript_text,parent_label,stage_label')
          .eq('archive_id', id)
          .eq('translation_status', 'PUBLISHED');
        if (error) {
          this.error.set('Could not load translations from Supabase.');
          return false;
        }
        const rows = (data ?? []) as TranslationRow[];
        await this.storage
          .resolveMediaReferences(
            rows.flatMap((item) =>
              this.storage.mediaReferences(this.parseNodes(item.transcript_text)),
            ),
          )
          .catch(() => this.error.set('Could not load translation images.'));
        this.transcripts.update((records) =>
          records.map((record) =>
            record.id === id
              ? {
                  ...record,
                  translations: Object.fromEntries(
                    rows.map((item) => [
                      item.language_code.trim().toLowerCase(),
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
        this.loadedTranslationIds.add(id);
        return true;
      })();
      this.pendingTranslationLoads.set(id, request);
    }

    const loaded = await request;
    if (this.pendingTranslationLoads.get(id) === request) {
      this.pendingTranslationLoads.delete(id);
    }
    if (loaded) onLoaded?.();
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
          localizedLabel:
            category === 'interrogation' ? chapter.name : this.localizedChapterName(chapter),
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
          localizedLabel:
            category === 'interrogation' ? t.parentLabel : this.localizedTranscriptParentName(t),
          category: t.category,
          stages: [],
        };
        group.stages.push({
          id: t.id,
          label: this.localizedTranscriptStageName(t),
          canonicalLabel: t.stageLabel,
          name: this.localizedTranscriptTitle(t),
        });
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
      nameTranslations: item.name_translations ?? {},
      backgroundImage: this.storage.toPublicUrl(item.background_image),
      category: this.categoryFromApi(item.category),
    };
  }

  public localizedChapterName(chapter: Chapter): string {
    if (chapter.category === 'interrogation') {
      return chapter.name;
    }
    const selectedLanguage = this.language.current().trim().toLowerCase();
    if (selectedLanguage === 'en') {
      return chapter.name;
    }
    const translatedName = Object.entries(chapter.nameTranslations ?? {}).find(
      ([language]) => language.trim().toLowerCase() === selectedLanguage,
    )?.[1];
    return translatedName?.trim() || chapter.name;
  }

  private localizedTranscriptTranslation(transcript: Transcript): TranscriptTranslation | undefined {
    const selectedLanguage = this.language.current().trim().toLowerCase();
    return Object.entries(transcript.translations ?? {}).find(
      ([language]) => language.trim().toLowerCase() === selectedLanguage,
    )?.[1];
  }

  private localizedTranscriptParentName(transcript: Transcript): string {
    return this.localizedTranscriptTranslation(transcript)?.parentLabel?.trim() || transcript.parentLabel;
  }

  public localizedTranscriptStageName(transcript: Transcript): string {
    if (transcript.category === 'interrogation') {
      return transcript.stageLabel;
    }
    return this.localizedTranscriptTranslation(transcript)?.stageLabel?.trim() || transcript.stageLabel;
  }

  public localizedTranscriptTitle(transcript: Transcript): string {
    if (transcript.category === 'interrogation') {
      return transcript.title;
    }
    return this.localizedTranscriptTranslation(transcript)?.title?.trim() || transcript.title;
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
  private parseNodes(value?: DialogueNode[] | null): DialogueNode[] {
    return value ?? [];
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
