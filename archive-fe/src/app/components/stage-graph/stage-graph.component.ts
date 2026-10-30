import { Component, inject, Input } from '@angular/core';
import { Router } from '@angular/router';
import { StageOrganizationEdge } from '../../models/stage-organization.models';

export interface StageGraphStage {
  id: string;
  label: string;
  name?: string;
  link: string[];
}

type StageNode = StageGraphStage & {
  column: number;
  row: number;
  stageNumber: string;
  stageName: string;
};

@Component({
  standalone: true,
  selector: 'app-stage-graph',
  templateUrl: './stage-graph.component.html',
  styleUrl: './stage-graph.component.css',
})
export class StageGraphComponent {
  private readonly router = inject(Router);

  @Input() stages: StageGraphStage[] = [];
  @Input() edges: StageOrganizationEdge[] = [];
  @Input() title = '';

  public readonly nodeWidth = 208;
  public readonly nodeHeight = 64;

  public isDragging = false;

  private dragStartX = 0;
  private dragStartY = 0;
  private scrollStartLeft = 0;
  private scrollStartTop = 0;
  private dragMoved = false;
  private suppressClick = false;

  public get nodes(): StageNode[] {
    const displayStage = (stage: StageGraphStage) => {
      const separator = stage.label.indexOf('|');
      const stageNumber = separator < 0 ? stage.label.trim() : stage.label.slice(0, separator).trim();
      const stageName = stage.name?.trim() || (separator < 0 ? '' : stage.label.slice(separator + 1).trim());
      return { ...stage, stageNumber, stageName };
    };

    if (!this.edges.length) {
      return this.stages.map((stage, index) => ({
        ...displayStage(stage),
        column: index,
        row: 0,
      }));
    }

    const stageIds = new Set(this.stages.map((stage) => stage.id));
    const incoming = new Map<string, string[]>();
    this.stages.forEach((stage) => incoming.set(stage.id, []));
    this.edges.forEach((edge) => {
      if (stageIds.has(edge.from) && stageIds.has(edge.to)) incoming.get(edge.to)?.push(edge.from);
    });

    const ranks = new Map(this.stages.map((stage) => [stage.id, 0]));
    for (let pass = 0; pass < this.stages.length; pass += 1) {
      this.stages.forEach((stage) => {
        const parents = incoming.get(stage.id) ?? [];
        if (parents.length) {
          ranks.set(
            stage.id,
            Math.max(...parents.map((parentId) => (ranks.get(parentId) ?? 0) + 1)),
          );
        }
      });
    }

    const groups = new Map<number, StageGraphStage[]>();
    this.stages.forEach((stage) => {
      const rank = ranks.get(stage.id) ?? 0;
      const group = groups.get(rank) ?? [];
      group.push(stage);
      groups.set(rank, group);
    });

    const maxGroupSize = Math.max(1, ...[...groups.values()].map((group) => group.length));
    const rowById = new Map<string, number>();
    const maxRank = Math.max(0, ...groups.keys());

    for (let rank = 0; rank <= maxRank; rank += 1) {
      const group = groups.get(rank) ?? [];
      if (rank === 0) {
        const rootOffset = group.length === 1 ? (maxGroupSize - 1) / 2 : 0;
        group.forEach((stage, index) => rowById.set(stage.id, rootOffset + index));
        continue;
      }

      const singleParentGroups = new Map<string, StageGraphStage[]>();
      const multiParentStages: StageGraphStage[] = [];
      const unconnectedStages: StageGraphStage[] = [];

      group.forEach((stage) => {
        const parents = incoming.get(stage.id) ?? [];
        if (parents.length === 1) {
          const siblings = singleParentGroups.get(parents[0]) ?? [];
          siblings.push(stage);
          singleParentGroups.set(parents[0], siblings);
        } else if (parents.length > 1) {
          multiParentStages.push(stage);
        } else {
          unconnectedStages.push(stage);
        }
      });

      singleParentGroups.forEach((siblings, parentId) => {
        const parentRow = rowById.get(parentId) ?? 0;
        siblings.forEach((stage, index) => {
          rowById.set(stage.id, parentRow + index - (siblings.length - 1) / 2);
        });
      });

      multiParentStages.forEach((stage) => {
        const parentRows = (incoming.get(stage.id) ?? [])
          .map((parentId) => rowById.get(parentId))
          .filter((row): row is number => row !== undefined);
        const row = parentRows.length
          ? parentRows.reduce((total, parentRow) => total + parentRow, 0) / parentRows.length
          : 0;
        rowById.set(stage.id, row);
      });

      unconnectedStages.forEach((stage, index) => rowById.set(stage.id, index));
    }

    return this.stages.map((stage) => ({
      ...displayStage(stage),
      column: ranks.get(stage.id) ?? 0,
      row: rowById.get(stage.id) ?? 0,
    }));
  }

  public get mapWidth(): number {
    const columns = Math.max(1, ...this.nodes.map((node) => node.column + 1));
    return columns * this.nodeWidth + Math.max(0, columns - 1) * 80 + 32;
  }

  public get mapHeight(): number {
    const rows = Math.max(1, ...this.nodes.map((node) => node.row + 1));
    return rows * 112 + 32;
  }

  public node(id: string): StageNode | undefined {
    return this.nodes.find((item) => item.id === id);
  }

  public nodeX(node: StageNode): number {
    return 16 + node.column * 288 + this.nodeWidth / 2;
  }

  public nodeY(node: StageNode): number {
    return 16 + node.row * 112 + this.nodeHeight / 2;
  }

  public edgePath(edge: StageOrganizationEdge): string {
    const from = this.node(edge.from);
    const to = this.node(edge.to);
    if (!from || !to) return '';
    const startX = this.nodeX(from) + this.nodeWidth / 2;
    const startY = this.nodeY(from);
    const endX = this.nodeX(to) - this.nodeWidth / 2;
    const endY = this.nodeY(to);
    const middleX = startX + (endX - startX) / 2;
    return startY === endY
      ? `M ${startX} ${startY} H ${endX}`
      : `M ${startX} ${startY} H ${middleX} V ${endY} H ${endX}`;
  }

  public startDragging(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const viewport = event.currentTarget as HTMLElement;
    this.isDragging = true;
    this.dragMoved = false;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.scrollStartLeft = viewport.scrollLeft;
    this.scrollStartTop = viewport.scrollTop;
    viewport.setPointerCapture(event.pointerId);
  }

  public drag(event: PointerEvent) {
    if (!this.isDragging) return;
    const viewport = event.currentTarget as HTMLElement;
    const deltaX = event.clientX - this.dragStartX;
    const deltaY = event.clientY - this.dragStartY;
    if (Math.hypot(deltaX, deltaY) > 6) this.dragMoved = true;
    viewport.scrollLeft = this.scrollStartLeft - deltaX;
    viewport.scrollTop = this.scrollStartTop - deltaY;
  }

  public endDragging(event: PointerEvent) {
    if (!this.isDragging) return;
    const viewport = event.currentTarget as HTMLElement;
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    this.isDragging = false;
    this.suppressClick = this.dragMoved;
  }

  public openStage(event: MouseEvent, link: string[]) {
    event.preventDefault();
    if (this.suppressClick) {
      event.stopPropagation();
      this.suppressClick = false;
      return;
    }
    void this.router.navigate(link);
  }
}
