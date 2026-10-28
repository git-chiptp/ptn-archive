export type StageOrganizationMode = 'graph' | 'list';

export interface StageOrganizationEdge {
  id: string;
  from: string;
  to: string;
}

export interface StageOrganization {
  edges: StageOrganizationEdge[];
  stageOrder: string[];
}
