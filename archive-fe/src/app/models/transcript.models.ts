export type Category =
  'main-story' | 'eternal-nightmare' | 'event-story' | 'interrogation' | 'mirage' | 'perspectra';
export type Gender = 'male' | 'female';
export type LanguageCode = string;
export interface TranscriptTranslation {
  title?: string;
  parentLabel?: string;
  stageLabel?: string;
  description?: string;
  nodes?: DialogueNode[];
}
export type DialogueNode = LineNode | ImageNode;
export interface LineNode {
  type: 'line';
  id: string;
  speaker?: string;
  sprite?: string;
  text?: string;
  description?: string;
  format?: { bold?: boolean; italic?: boolean; color?: string };
  variants?: { male: string; female: string };
  options?: LineOption[];
}
export interface LineOption {
  id: string;
  label: string;
  nodes: DialogueNode[];
}
export interface ImageNode {
  type: 'image';
  id: string;
  src: string;
  variants?: { male?: string; female?: string };
}
export interface Transcript {
  id: string;
  title: string;
  category: Category;
  parentId: string;
  parentLabel: string;
  stageLabel: string;
  description: string;
  nodes: DialogueNode[];
  sourceLanguage?: LanguageCode;
  translations?: Record<string, TranscriptTranslation>;
}
export interface Collection {
  id: string;
  label: string;
  localizedLabel: string;
  category: Category;
  backgroundImage?: string;
  stages: { id: string; label: string; canonicalLabel: string; name?: string }[];
}
export interface Chapter {
  id: string;
  category?: Category;
  name: string;
  nameTranslations?: Record<string, string>;
  backgroundImage?: string;
}
