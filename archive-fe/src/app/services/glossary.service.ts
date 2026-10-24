import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT } from './supabase.client';

export interface GlossaryEntry {
  id: string;
  english: string;
  chinese: string;
  vietnamese: string;
  detail: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type GlossaryInput = Pick<
  GlossaryEntry,
  'english' | 'chinese' | 'vietnamese' | 'detail' | 'note'
>;

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

const GLOSSARY_COLUMNS = 'id,english,chinese,vietnamese,detail,note,created_at,updated_at';

@Injectable({ providedIn: 'root' })
export class GlossaryService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  public async list(): Promise<GlossaryEntry[]> {
    const { data, error } = await this.supabase
      .from('glossary_terms')
      .select(GLOSSARY_COLUMNS)
      .order('english', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return ((data ?? []) as GlossaryRow[]).map((row) => this.toEntry(row));
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
    return this.toEntry(data as GlossaryRow);
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
    return this.toEntry(data as GlossaryRow);
  }

  public async removeMany(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return;
    const { error } = await this.supabase.from('glossary_terms').delete().in('id', uniqueIds);
    if (error) throw error;
  }

  private toEntry(row: GlossaryRow): GlossaryEntry {
    return {
      id: row.id,
      english: row.english,
      chinese: row.chinese,
      vietnamese: row.vietnamese,
      detail: row.detail,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
