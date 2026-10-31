import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT } from './supabase.client';

export interface GlossaryTag {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface GlossaryEntry {
  id: string;
  english: string;
  chinese: string;
  vietnamese: string;
  detail: string;
  note: string;
  tags: GlossaryTag[];
  createdAt: string;
  updatedAt: string;
}

export type GlossaryInput = Pick<
  GlossaryEntry,
  'english' | 'chinese' | 'vietnamese' | 'detail' | 'note'
> & {
  tagIds: string[];
};

export type GlossaryTagInput = Pick<GlossaryTag, 'name'>;

type GlossaryRow = {
  id: string;
  english: string;
  chinese: string;
  vietnamese: string;
  detail: string;
  note: string;
  created_at: string;
  updated_at: string;
};

type GlossaryTagRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type GlossaryTermTagRow = {
  glossary_term_id: string;
  tag_id: string;
};

const GLOSSARY_COLUMNS = 'id,english,chinese,vietnamese,detail,note,created_at,updated_at';
const TAG_COLUMNS = 'id,name,created_at,updated_at';

@Injectable({ providedIn: 'root' })
export class GlossaryService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  public async list(): Promise<GlossaryEntry[]> {
    const [terms, tags, assignments] = await Promise.all([
      this.supabase
        .from('glossary_terms')
        .select(GLOSSARY_COLUMNS)
        .order('vietnamese', { ascending: true })
        .order('english', { ascending: true })
        .order('created_at', { ascending: true }),
      this.supabase.from('glossary_tags').select(TAG_COLUMNS).order('name', { ascending: true }),
      this.supabase.from('glossary_term_tags').select('glossary_term_id,tag_id'),
    ]);

    if (terms.error) throw terms.error;
    if (tags.error) throw tags.error;
    if (assignments.error) throw assignments.error;

    const tagById = new Map(
      (tags.data as GlossaryTagRow[]).map((tag) => [tag.id, this.toTag(tag)]),
    );
    const tagsByTerm = new Map<string, GlossaryTag[]>();
    (assignments.data as GlossaryTermTagRow[]).forEach((assignment) => {
      const tag = tagById.get(assignment.tag_id);
      if (!tag) return;
      const entryTags = tagsByTerm.get(assignment.glossary_term_id) ?? [];
      entryTags.push(tag);
      tagsByTerm.set(assignment.glossary_term_id, entryTags);
    });

    return (terms.data as GlossaryRow[]).map((row) =>
      this.toEntry(row, tagsByTerm.get(row.id) ?? []),
    );
  }

  public async listTags(): Promise<GlossaryTag[]> {
    const { data, error } = await this.supabase
      .from('glossary_tags')
      .select(TAG_COLUMNS)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data as GlossaryTagRow[]).map((row) => this.toTag(row));
  }

  public async createTag(input: GlossaryTagInput): Promise<GlossaryTag> {
    const { data, error } = await this.supabase
      .from('glossary_tags')
      .insert({ name: input.name.trim() })
      .select(TAG_COLUMNS)
      .single();
    if (error || !data) throw error ?? new Error('Glossary tag was not created.');
    return this.toTag(data as GlossaryTagRow);
  }

  public async updateTag(id: string, input: GlossaryTagInput): Promise<GlossaryTag> {
    const { data, error } = await this.supabase
      .from('glossary_tags')
      .update({ name: input.name.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(TAG_COLUMNS)
      .single();
    if (error || !data) throw error ?? new Error('Glossary tag was not updated.');
    return this.toTag(data as GlossaryTagRow);
  }

  public async removeTag(id: string): Promise<void> {
    const { error } = await this.supabase.from('glossary_tags').delete().eq('id', id);
    if (error) throw error;
  }

  public async create(input: GlossaryInput): Promise<GlossaryEntry> {
    const { data, error } = await this.supabase
      .from('glossary_terms')
      .insert({
        english: input.english.trim(),
        chinese: input.chinese.trim(),
        vietnamese: input.vietnamese.trim(),
        detail: input.detail.trim(),
        note: input.note.trim(),
      })
      .select(GLOSSARY_COLUMNS)
      .single();

    if (error || !data) throw error ?? new Error('Glossary term was not created.');
    await this.replaceTags((data as GlossaryRow).id, input.tagIds);
    return this.toEntry(data as GlossaryRow, await this.tagsForTerm((data as GlossaryRow).id));
  }

  public async update(id: string, input: GlossaryInput): Promise<GlossaryEntry> {
    const { data, error } = await this.supabase
      .from('glossary_terms')
      .update({
        english: input.english.trim(),
        chinese: input.chinese.trim(),
        vietnamese: input.vietnamese.trim(),
        detail: input.detail.trim(),
        note: input.note.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(GLOSSARY_COLUMNS)
      .single();

    if (error || !data) throw error ?? new Error('Glossary term was not updated.');
    await this.replaceTags(id, input.tagIds);
    return this.toEntry(data as GlossaryRow, await this.tagsForTerm(id));
  }

  public async removeMany(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return;
    const { error } = await this.supabase.from('glossary_terms').delete().in('id', uniqueIds);
    if (error) throw error;
  }

  private async replaceTags(termId: string, tagIds: string[]): Promise<void> {
    const { error: deleteError } = await this.supabase
      .from('glossary_term_tags')
      .delete()
      .eq('glossary_term_id', termId);
    if (deleteError) throw deleteError;

    const uniqueTagIds = [...new Set(tagIds)];
    if (!uniqueTagIds.length) return;
    const { error: insertError } = await this.supabase.from('glossary_term_tags').insert(
      uniqueTagIds.map((tagId) => ({ glossary_term_id: termId, tag_id: tagId })),
    );
    if (insertError) throw insertError;
  }

  private async tagsForTerm(termId: string): Promise<GlossaryTag[]> {
    const { data, error } = await this.supabase
      .from('glossary_term_tags')
      .select('tag_id,glossary_tags(' + TAG_COLUMNS + ')')
      .eq('glossary_term_id', termId);
    if (error) throw error;
    return (data ?? [])
      .map((row) => (row as unknown as { glossary_tags: GlossaryTagRow | null }).glossary_tags)
      .filter((tag): tag is GlossaryTagRow => !!tag)
      .map((tag) => this.toTag(tag));
  }

  private toEntry(row: GlossaryRow, tags: GlossaryTag[] = []): GlossaryEntry {
    return {
      id: row.id,
      english: row.english,
      chinese: row.chinese,
      vietnamese: row.vietnamese,
      detail: row.detail,
      note: row.note,
      tags,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toTag(row: GlossaryTagRow): GlossaryTag {
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
