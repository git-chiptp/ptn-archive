import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT } from './supabase.client';

export interface ChronologyEntry {
  id: string;
  date: string;
  title: string;
  detail: string;
  icon: string;
  displayOrder: number;
}

export type ChronologyInput = Pick<ChronologyEntry, 'date' | 'title' | 'detail' | 'icon'> & {
  displayOrder: number;
};

type ChronologyRow = {
  id: string;
  event_date: string;
  title: string;
  detail: string;
  icon: string;
  display_order: number;
};

const CHRONOLOGY_COLUMNS = 'id,event_date,title,detail,icon,display_order';

@Injectable({ providedIn: 'root' })
export class ChronologyService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  public async list(): Promise<ChronologyEntry[]> {
    const { data, error } = await this.supabase
      .from('chronology_entries')
      .select(CHRONOLOGY_COLUMNS)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as ChronologyRow[]).map((row) => this.toEntry(row));
  }

  public async create(input: ChronologyInput): Promise<ChronologyEntry> {
    const { data, error } = await this.supabase
      .from('chronology_entries')
      .insert({
        event_date: input.date.trim(),
        title: input.title.trim(),
        detail: input.detail.trim(),
        icon: input.icon.trim() || 'pi pi-bolt',
        display_order: input.displayOrder,
      })
      .select(CHRONOLOGY_COLUMNS)
      .single();
    if (error || !data) throw error ?? new Error('Chronology entry was not created.');
    return this.toEntry(data as ChronologyRow);
  }

  public async update(id: string, input: ChronologyInput): Promise<ChronologyEntry> {
    const { data, error } = await this.supabase
      .from('chronology_entries')
      .update({
        event_date: input.date.trim(),
        title: input.title.trim(),
        detail: input.detail.trim(),
        icon: input.icon.trim() || 'pi pi-bolt',
        display_order: input.displayOrder,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(CHRONOLOGY_COLUMNS)
      .single();
    if (error || !data) throw error ?? new Error('Chronology entry was not updated.');
    return this.toEntry(data as ChronologyRow);
  }

  public async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('chronology_entries').delete().eq('id', id);
    if (error) throw error;
  }

  public async reorder(ids: string[]): Promise<void> {
    const updates = ids.map((id, displayOrder) =>
      this.supabase
        .from('chronology_entries')
        .update({ display_order: displayOrder, updated_at: new Date().toISOString() })
        .eq('id', id),
    );
    const results = await Promise.all(updates);
    const failed = results.find(({ error }) => error);
    if (failed?.error) throw failed.error;
  }

  private toEntry(row: ChronologyRow): ChronologyEntry {
    return {
      id: row.id,
      date: row.event_date,
      title: row.title,
      detail: row.detail,
      icon: row.icon,
      displayOrder: row.display_order,
    };
  }
}
