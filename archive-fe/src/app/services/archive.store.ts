import { Injectable, signal } from '@angular/core';
import { Collection, Gender, Transcript } from '../models/transcript.models';
import { TRANSCRIPTS } from '../data/transcript-data';
@Injectable({ providedIn: 'root' })
export class ArchiveStore {
  readonly gender = signal<Gender>('female');
  readonly transcripts = signal<Transcript[]>(TRANSCRIPTS);
  setGender(gender: Gender) {
    this.gender.set(gender);
  }
  add(transcript: Transcript) {
    this.transcripts.update((items) => [...items, transcript]);
  }
  update(transcript: Transcript) {
    this.transcripts.update((items) =>
      items.map((item) => (item.id === transcript.id ? transcript : item)),
    );
  }
  remove(id: string) {
    this.transcripts.update((items) => items.filter((item) => item.id !== id));
  }
  collections(category: string): Collection[] {
    const groups = new Map<string, Collection>();
    this.transcripts()
      .filter((t) => t.category === category)
      .forEach((t) => {
        const group = groups.get(t.parentId) ?? {
          id: t.parentId,
          label: t.parentLabel,
          category: t.category,
          stages: [],
        };
        group.stages.push({ id: t.id, label: t.stageLabel });
        groups.set(t.parentId, group);
      });
    return [...groups.values()];
  }
}
