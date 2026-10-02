export type Category = 'main-story' | 'event-story' | 'interrogation' | 'perspectra';
export type Gender = 'male' | 'female';
export type LanguageCode = string;
export interface TranscriptTranslation { title?: string; parentLabel?: string; stageLabel?: string; description?: string; nodes?: DialogueNode[]; }
export type DialogueNode = LineNode | ChoiceNode;
export interface LineNode {
  type: 'line';
  id: string;
  speaker?: string;
  text?: string;
  description?: string;
  format?: { bold?: boolean; italic?: boolean; color?: string };
  variants?: { male: string; female: string };
}
export interface ChoiceOption {
  id: string;
  label: string;
  nodes: DialogueNode[];
}
export interface ChoiceNode {
  type: 'choice';
  id: string;
  prompt?: string;
  options: ChoiceOption[];
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
  category: Category;
  backgroundImage?: string;
  stages: { id: string; label: string }[];
}
export interface Chapter {
  id: string;
  category?: Category;
  name: string;
  backgroundImage?: string;
}
