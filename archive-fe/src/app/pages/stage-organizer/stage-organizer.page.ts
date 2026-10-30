import { Component, computed, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { OrderListModule } from 'primeng/orderlist';
import { Category, Collection } from '../../models/transcript.models';
import { StageOrganizationEdge } from '../../models/stage-organization.models';
import { StageGraphComponent, StageGraphStage } from '../../components/stage-graph/stage-graph.component';
import { ArchiveStore } from '../../services/archive.store';
import { LanguageService } from '../../services/language.service';
import { StageOrganizationService } from '../../services/stage-organization.service';

type StageOption = {
  label: string;
  value: string;
};

@Component({
  standalone: true,
  imports: [
    FormsModule,
    BreadcrumbModule,
    ButtonModule,
    SelectModule,
    OrderListModule,
    StageGraphComponent,
  ],
  templateUrl: './stage-organizer.page.html',
})
export class StageOrganizerPage {
  public readonly language = inject(LanguageService);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  public readonly store = inject(ArchiveStore);
  private readonly organizations = inject(StageOrganizationService);
  private readonly category = this.route.snapshot.queryParamMap.get('category') as Category | null;
  private readonly parentId = this.route.snapshot.queryParamMap.get('parentId') ?? '';
  private readonly parentLabel = this.route.snapshot.queryParamMap.get('parentLabel') ?? '';

  public readonly selectedCollection = computed<Collection | undefined>(() => {
    if (this.category !== 'main-story' && this.category !== 'event-story') return undefined;
    return this.store
      .collections(this.category)
      .find((collection) => collection.id === this.parentId || collection.label === this.parentLabel);
  });

  public edges: StageOrganizationEdge[] = [];
  public orderedStages: StageGraphStage[] = [];
  public fromStage = '';
  public toStage = '';
  public status = '';
  public stageOrderStatus = '';
  public readonly breadcrumbHome: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  public get isLoading() {
    return this.store.loading();
  }

  public get breadcrumbItems(): MenuItem[] {
    const collection = this.selectedCollection();
    if (!this.category || !collection) return [{ label: this.language.text('stageOrganizer') }];
    return [
      {
        label: this.language.text(this.category === 'event-story' ? 'eventStory' : 'mainStory'),
        routerLink: ['/', this.category],
      },
      { label: collection.localizedLabel, routerLink: ['/', this.category, this.slug(collection.label)] },
      { label: this.language.text('stageOrganizer') },
    ];
  }

  constructor() {
    if (this.category) {
      void this.store.ensureCollectionLoaded(this.category, this.parentId, this.parentLabel);
    }
    effect(() => {
      const collection = this.selectedCollection();
      if (!this.category || !collection) return;
      void this.organizations.load(this.category, this.parentId, this.parentLabel).catch(() => {
        this.status = this.language.text('stageOrganizationLoadFailed');
      });
    });

    effect(() => {
      const collection = this.selectedCollection();
      if (!this.category || !collection) return;

      const organization = this.organizations.get(this.category, collection.id, collection.label);
      this.edges = organization.edges;
      this.orderedStages = this.orderStages(this.stages, organization.stageOrder);
    });
  }

  public get stages(): StageGraphStage[] {
    const collection = this.selectedCollection();
    const category = this.category;
    if (!collection || !category) return [];
    return collection.stages.map((stage) => ({
      id: stage.id,
      label: stage.label,
      name: stage.name,
      link: ['/', category, this.slug(collection.label), this.slug(stage.canonicalLabel)],
    }));
  }

  public get stageOptions(): StageOption[] {
    return this.stages.map((stage) => ({ label: stage.label, value: stage.id }));
  }

  public saveStageOrder() {
    this.persist(
      'stageOrderUpdated',
      this.orderedStages.map((stage) => stage.id),
      'stageOrder',
    );
  }

  public connectStages() {
    if (!this.fromStage || !this.toStage || this.fromStage === this.toStage) return;
    if (this.edges.some((edge) => edge.from === this.fromStage && edge.to === this.toStage)) return;
    this.edges = [
      ...this.edges,
      { id: `edge-${this.edges.length + 1}`, from: this.fromStage, to: this.toStage },
    ];
    this.persist();
  }

  public removeEdge(id: string) {
    this.edges = this.edges.filter((edge) => edge.id !== id);
    this.persist();
  }

  public showList() {
    if (this.category) {
      this.organizations.setView(this.category, this.parentId, this.parentLabel, 'list');
    }
    this.goToSelector();
  }

  public returnToSelector() {
    this.goToSelector();
  }

  public resetGraph() {
    this.edges = [];
    this.fromStage = '';
    this.toStage = '';
    this.persist();
  }

  public stageNumber(stage: { label: string }): string {
    const separator = stage.label.indexOf('|');
    return separator < 0 ? stage.label.trim() : stage.label.slice(0, separator).trim();
  }

  public stageName(stage: { label: string; name?: string }): string {
    const separator = stage.label.indexOf('|');
    return stage.name?.trim() || (separator < 0 ? '' : stage.label.slice(separator + 1).trim());
  }

  public nodeLabel(id: string): string {
    return this.stages.find((stage) => stage.id === id)?.label ?? id;
  }

  public slug(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private orderStages(stages: StageGraphStage[], savedOrder: string[]): StageGraphStage[] {
    const stagesById = new Map(stages.map((stage) => [stage.id, stage]));
    const used = new Set<string>();
    const ordered = savedOrder.flatMap((id) => {
      const stage = stagesById.get(id);
      if (!stage || used.has(id)) return [];
      used.add(id);
      return [stage];
    });

    return [...ordered, ...stages.filter((stage) => !used.has(stage.id))];
  }

  private persist(
    statusKey = 'graphUpdated',
    stageOrder?: string[],
    statusTarget: 'graph' | 'stageOrder' = 'graph',
  ) {
    if (!this.category) return;
    const organization = this.organizations.get(this.category, this.parentId, this.parentLabel);
    void this.organizations
      .set(this.category, this.parentId, this.parentLabel, {
        edges: this.edges,
        stageOrder: stageOrder ?? organization.stageOrder,
      })
      .then(() => {
        const message = this.language.text(statusKey);
        if (statusTarget === 'stageOrder') {
          this.stageOrderStatus = message;
        } else {
          this.status = message;
        }
      })
      .catch(() => {
        const message = this.language.text('stageOrganizationSaveFailed');
        if (statusTarget === 'stageOrder') {
          this.stageOrderStatus = message;
        } else {
          this.status = message;
        }
      });
  }

  private goToSelector() {
    if (!this.category || !this.selectedCollection()) return;
    this.router.navigate(['/', this.category, this.slug(this.selectedCollection()!.label)]);
  }
}
