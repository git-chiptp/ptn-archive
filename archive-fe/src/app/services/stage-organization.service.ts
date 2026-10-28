import { Injectable, inject, signal } from '@angular/core';
import { Category } from '../models/transcript.models';
import {
  StageOrganization,
  StageOrganizationEdge,
  StageOrganizationMode,
} from '../models/stage-organization.models';
import { SUPABASE_CLIENT } from './supabase.client';

type StageOrganizationRow = {
  category: string;
  parent_id: string;
  parent_label: string;
  edges: unknown;
  stage_order: unknown;
};

const EMPTY_ORGANIZATION: StageOrganization = { edges: [], stageOrder: [] };

@Injectable({ providedIn: 'root' })
export class StageOrganizationService {
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly cache = new Map<string, StageOrganization>();
  private readonly loaded = new Set<string>();

  public readonly revision = signal(0);

  public get(category: Category, parentId: string, parentLabel: string): StageOrganization {
    this.revision();
    return this.cache.get(this.key(category, parentId, parentLabel)) ?? { ...EMPTY_ORGANIZATION };
  }

  public getView(category: Category, parentId: string, parentLabel: string): StageOrganizationMode {
    try {
      const value = localStorage.getItem(this.viewKey(category, parentId, parentLabel));
      return value === 'graph' ? 'graph' : 'list';
    } catch {
      return 'list';
    }
  }

  public setView(
    category: Category,
    parentId: string,
    parentLabel: string,
    mode: StageOrganizationMode,
  ): void {
    try {
      localStorage.setItem(this.viewKey(category, parentId, parentLabel), mode);
    } catch {
      return;
    }
  }

  public async load(category: Category, parentId: string, parentLabel: string): Promise<void> {
    const key = this.key(category, parentId, parentLabel);
    if (this.loaded.has(key)) return;
    this.loaded.add(key);

    const { data, error } = await this.supabase
      .from('stage_organizations')
      .select('category,parent_id,parent_label,edges,stage_order')
      .eq('category', category)
      .eq('parent_id', parentId)
      .eq('parent_label', parentLabel)
      .maybeSingle();

    if (error) {
      this.loaded.delete(key);
      throw error;
    }

    this.cache.set(key, data ? this.fromRow(data as StageOrganizationRow) : { ...EMPTY_ORGANIZATION });
    this.revision.update((value) => value + 1);
  }

  public async set(
    category: Category,
    parentId: string,
    parentLabel: string,
    organization: StageOrganization,
  ): Promise<void> {
    const key = this.key(category, parentId, parentLabel);
    this.cache.set(key, organization);
    this.loaded.add(key);
    this.revision.update((value) => value + 1);

    const { error } = await this.supabase.from('stage_organizations').upsert(
      {
        category,
        parent_id: parentId,
        parent_label: parentLabel,
        edges: organization.edges,
        stage_order: organization.stageOrder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category,parent_id,parent_label' },
    );
    if (error) throw error;
  }

  private fromRow(row: StageOrganizationRow): StageOrganization {
    const edges = Array.isArray(row.edges) ? row.edges.filter(this.isEdge) : [];
    const stageOrder = Array.isArray(row.stage_order)
      ? row.stage_order.filter((id): id is string => typeof id === 'string')
      : [];
    return { edges, stageOrder };
  }

  private key(category: Category, parentId: string, parentLabel: string): string {
    return `${category}:${parentId || parentLabel}`;
  }

  private viewKey(category: Category, parentId: string, parentLabel: string): string {
    return `archive-stage-view:${this.key(category, parentId, parentLabel)}`;
  }

  private isEdge(value: unknown): value is StageOrganizationEdge {
    if (!value || typeof value !== 'object') return false;
    const edge = value as Partial<StageOrganizationEdge>;
    return typeof edge.id === 'string' && typeof edge.from === 'string' && typeof edge.to === 'string';
  }
}
