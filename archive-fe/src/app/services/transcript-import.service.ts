import { Injectable } from '@angular/core';
import { LineNode } from '../models/transcript.models';

export interface ImportedLine {
  speaker: string;
  text: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class TranscriptImportService {
  parseDelimited(contents: string): ImportedLine[] {
    const rows = contents
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter((row) => row.trim());
    if (!rows.length) return [];
    const delimiter = rows[0].includes('\t') ? '\t' : ',';
    const values = rows.map((row) => this.parseRow(row, delimiter));
    const header = values[0].map((value) => value.trim().toLowerCase());
    const hasHeader = header.some((value) =>
      ['speaker', 'text', 'line', 'description'].includes(value),
    );
    const columns = hasHeader ? header : ['speaker', 'text', 'description'];
    return (hasHeader ? values.slice(1) : values)
      .map((row) => ({
        speaker: row[columns.indexOf('speaker')] ?? '',
        text:
          row[columns.indexOf('text') >= 0 ? columns.indexOf('text') : columns.indexOf('line')] ??
          '',
        description: row[columns.indexOf('description')] ?? '',
      }))
      .filter((line) => line.speaker || line.text || line.description);
  }

  toNodes(lines: ImportedLine[]): LineNode[] {
    return lines.map((line, index) => ({
      type: 'line',
      id: `imported-${index + 1}`,
      speaker: line.speaker,
      text: line.text,
      description: line.description || undefined,
    }));
  }

  private parseRow(row: string, delimiter: string): string[] {
    const cells: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < row.length; i += 1) {
      const char = row[i];
      if (char === '"' && row[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) {
        cells.push(cell.trim());
        cell = '';
      } else cell += char;
    }
    cells.push(cell.trim());
    return cells;
  }
}
