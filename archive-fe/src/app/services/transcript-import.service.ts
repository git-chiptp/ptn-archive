import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, timeout } from 'rxjs/operators';

export interface ImportedLine {
  speaker: string;
  text: string;
  description: string;
  type?: string;
  prompt?: string;
  option?: string;
  depth?: number;
}

@Injectable({ providedIn: 'root' })
export class TranscriptImportService {
  private readonly http = inject(HttpClient);

  private readonly importUrl = 'http://localhost:8080/api/transcripts/import';

  public parseXlsx(file: File) {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<ImportedLine[] | { lines?: ImportedLine[] }>(this.importUrl, body).pipe(
      timeout(15000),
      map((response) => (Array.isArray(response) ? response : (response.lines ?? []))),
    );
  }

  public toNodes(lines: ImportedLine[]): any[] {
    const nodes: any[] = [];
    const choices: { depth: number; node: any }[] = [];
    const options: { depth: number; node: any }[] = [];
    lines.forEach((line, index) => {
      const depth = line.depth ?? 0;
      const keepsCurrentParent = line.type !== 'option';
      const cutoff = keepsCurrentParent ? depth : depth - 1;
      while (choices.length && choices[choices.length - 1].depth > cutoff) {
        choices.pop();
      }
      while (options.length && options[options.length - 1].depth > cutoff) {
        options.pop();
      }
      if (line.type === 'choice') {
        const node = {
          type: 'choice',
          id: `imported-choice-${index + 1}`,
          prompt: line.prompt || line.text,
          options: [],
        };
        const parentOption = [...options].reverse().find((item) => item.depth <= depth);
        if (parentOption) {
          parentOption.node.nodes.push(node);
        } else {
          nodes.push(node);
        }
        choices.push({ depth, node });
        return;
      }
      if (line.type === 'option') {
        const parentChoice = [...choices].reverse().find((item) => item.depth < depth);
        if (!parentChoice) {
          return;
        }
        const option = {
          id: `imported-option-${index + 1}`,
          label: line.option || line.text,
          nodes: [] as any[],
        };
        parentChoice.node.options.push(option);
        options.push({ depth, node: option });
        return;
      }
      const node = {
        type: 'line',
        id: `imported-${index + 1}`,
        speaker: line.speaker,
        text: line.text || line.description,
        description: line.description || undefined,
      };
      const parentOption = [...options].reverse().find((item) => item.depth <= depth);
      if (parentOption && line.type === 'option-line') {
        parentOption.node.nodes.push(node);
      } else {
        nodes.push(node);
      }
    });
    return nodes;
  }
}
