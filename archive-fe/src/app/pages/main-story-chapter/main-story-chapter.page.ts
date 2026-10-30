import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { Category } from '../../models/transcript.models';
import { AuthService } from '../../services/auth.service';
import { ArchiveStore } from '../../services/archive.store';
import { LanguageService } from '../../services/language.service';
import { StageOrganizationService } from '../../services/stage-organization.service';
import { StageGraphComponent, StageGraphStage } from '../../components/stage-graph/stage-graph.component';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { StageOrganizationMode } from '../../models/stage-organization.models';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    SelectButtonModule,
    BreadcrumbModule,
    StageGraphComponent,
  ],
  templateUrl: './main-story-chapter.page.html',
})
export class MainStoryChapterPage {
  readonly store = inject(ArchiveStore);

  readonly auth = inject(AuthService);

  readonly language = inject(LanguageService);

  private route = inject(ActivatedRoute);
  private readonly organizations = inject(StageOrganizationService);

  public get category(): Category {
    return (this.route.snapshot.data['category'] as Category | undefined) ?? 'main-story';
  }

  public readonly breadcrumbHome: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  constructor() {
    void this.store.ensureCollectionLoadedBySlug(
      this.category,
      this.route.snapshot.paramMap.get('chapterId') ?? '',
    );
    effect(() => {
      const collection = this.chapter;
      if (!collection) return;
      void this.organizations.load(this.category, collection.id, collection.label);
    });
  }

  public get viewOptions() {
    return [
      { label: this.language.text('defaultView'), value: 'list' as StageOrganizationMode },
      { label: this.language.text('graphView'), value: 'graph' as StageOrganizationMode },
    ];
  }

  public get selectedView(): StageOrganizationMode {
    const collection = this.chapter;
    return collection
      ? this.organizations.getView(this.category, collection.id, collection.label)
      : 'list';
  }

  public setView(mode: StageOrganizationMode) {
    const collection = this.chapter;
    if (!collection) return;
    this.organizations.setView(this.category, collection.id, collection.label, mode);
  }

  public get orderedStages() {
    const collection = this.chapter;
    if (!collection) return [];
    const stagesById = new Map(collection.stages.map((stage) => [stage.id, stage]));
    const used = new Set<string>();
    const savedOrder = this.organization?.stageOrder ?? [];
    const ordered = savedOrder.flatMap((id) => {
      const stage = stagesById.get(id);
      if (!stage || used.has(id)) return [];
      used.add(id);
      return [stage];
    });
    return [...ordered, ...collection.stages.filter((stage) => !used.has(stage.id))];
  }

  public get breadcrumbItems(): MenuItem[] {
    return [
      {
        label: this.language.text(
          this.category === 'main-story' ? 'mainStory' : 'eternalNightmare',
        ),
        routerLink: '/' + this.category,
      },
      ...(this.chapter ? [{ label: this.chapter.localizedLabel }] : []),
    ];
  }

  public get chapter() {
    const slug = this.route.snapshot.paramMap.get('chapterId');
    return this.store
      .collections(this.category)
      .find((collection) => this.slug(collection.label) === slug);
  }

  public get organization() {
    const collection = this.chapter;
    return collection ? this.organizations.get(this.category, collection.id, collection.label) : null;
  }

  public get graphStages(): StageGraphStage[] {
    const collection = this.chapter;
    if (!collection) return [];
    return collection.stages.map((stage) => ({
      id: stage.id,
      label: stage.label,
      name: stage.name,
      link: ['/', this.category, this.slug(collection.label), this.slug(stage.canonicalLabel)],
    }));
  }

  public stageNumber(stage: { label: string }): string {
    const separator = stage.label.indexOf('|');
    return separator < 0 ? stage.label.trim() : stage.label.slice(0, separator).trim();
  }

  public stageName(stage: { label: string; name?: string }): string {
    const separator = stage.label.indexOf('|');
    return (
      stage.name?.trim() || (separator < 0 ? '' : stage.label.slice(separator + 1).trim())
    );
  }

  public slug(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
