import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../services/auth.service';
import { BreadcrumbModule } from 'primeng/breadcrumb';
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
  templateUrl: './event-story.page.html',
})
export class EventStoryPage {
  readonly store = inject(ArchiveStore);
  readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);
  private route = inject(ActivatedRoute);
  private readonly organizations = inject(StageOrganizationService);
  public readonly breadcrumbHome: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  constructor() {
    effect(() => {
      const collection = this.event;
      if (!collection) return;
      void this.organizations.load('event-story', collection.id, collection.label);
    });
  }

  public get viewOptions() {
    return [
      { label: this.language.text('defaultView'), value: 'list' as StageOrganizationMode },
      { label: this.language.text('graphView'), value: 'graph' as StageOrganizationMode },
    ];
  }

  public get selectedView(): StageOrganizationMode {
    const collection = this.event;
    return collection
      ? this.organizations.getView('event-story', collection.id, collection.label)
      : 'list';
  }

  public setView(mode: StageOrganizationMode) {
    const collection = this.event;
    if (!collection) return;
    this.organizations.setView('event-story', collection.id, collection.label, mode);
  }

  public get orderedStages() {
    const collection = this.event;
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
      { label: this.language.text('eventStory'), routerLink: '/event-story' },
      ...(this.event ? [{ label: this.event.localizedLabel }] : []),
    ];
  }

  public get event() {
    const slug = this.route.snapshot.paramMap.get('eventId');
    return this.store
      .collections('event-story')
      .find((collection) => this.slug(collection.label) === slug);
  }

  public get organization() {
    const collection = this.event;
    return collection
      ? this.organizations.get('event-story', collection.id, collection.label)
      : null;
  }

  public get graphStages(): StageGraphStage[] {
    const collection = this.event;
    if (!collection) return [];
    return collection.stages.map((stage) => ({
      id: stage.id,
      label: stage.label,
      name: stage.name,
      link: ['/event-story', this.slug(collection.label), this.slug(stage.canonicalLabel)],
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
