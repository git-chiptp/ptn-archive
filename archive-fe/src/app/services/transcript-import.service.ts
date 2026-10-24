import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { defer, from } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ImportedLine {
  sprite?: string;
  src?: string;
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
  public parseXlsx(file: File, onProgress?: (progress: number) => void) {
    return defer(() => {
      onProgress?.(5);
      return from(file.arrayBuffer());
    }).pipe(
      map((buffer) => {
        onProgress?.(35);
        const workbook = XLSX.read(buffer, {
          cellHTML: true,
          cellStyles: true,
          cellFormula: false,
        });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          onProgress?.(100);
          return [];
        }
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: '',
          raw: false,
        });
        const imported = this.parseRows(rows, sheet);
        onProgress?.(100);
        return imported;
      }),
    );
  }

  private parseRows(rows: unknown[][], sheet: XLSX.WorkSheet): ImportedLine[] {
    if (!rows.length) {
      return [];
    }
    const first = rows[0].map((value) => this.cellText(value).trim().toLowerCase());
    const hasSpriteColumn = first[0] === 'sprite' && first[1] === 'speaker';
    const hasSpeakerHeader = first[0] === 'speaker';
    const start = hasSpriteColumn || hasSpeakerHeader ? 1 : 0;
    const imported: ImportedLine[] = [];
    for (let index = start; index < rows.length; index += 1) {
      const row = rows[index] ?? [];
      const line = this.parseRow(row, index, sheet, hasSpriteColumn);
      if (
        line.speaker.trim() ||
        line.text.trim() ||
        line.prompt?.trim() ||
        line.option?.trim() ||
        line.sprite?.trim() ||
        line.src?.trim()
      ) {
        imported.push(line);
      }
    }
    return imported;
  }

  private parseRow(
    row: unknown[],
    rowIndex: number,
    sheet: XLSX.WorkSheet,
    hasSpriteColumn: boolean,
  ): ImportedLine {
    const speakerColumn = hasSpriteColumn ? 1 : 0;
    const sprite = hasSpriteColumn ? this.cellText(row[0]).trim() : '';
    const speaker = this.cellText(row[speakerColumn]);
    let firstContent = speakerColumn + 1;
    while (firstContent < row.length && !this.cellText(row[firstContent]).trim()) {
      firstContent += 1;
    }
    const cell = firstContent < row.length ? this.cellAt(sheet, firstContent, rowIndex) : undefined;
    const raw = this.richText(cell, row[firstContent]);
    const markerText = this.decodeEntities(raw);
    const plain = this.stripTags(markerText).trim();
    const depth = Math.max(0, firstContent - 1);
    if (hasSpriteColumn && sprite && !speaker.trim() && !plain) {
      return {
        sprite: '',
        src: sprite,
        speaker: '',
        text: '',
        description: '',
        type: 'image',
        depth,
      };
    }
    if (plain.startsWith('\\>')) {
      return {
        sprite,
        speaker,
        text: this.removeLiteralMarker(markerText),
        description: '',
        type: depth > 0 ? 'option-line' : 'line',
        depth,
      };
    }
    if (plain.startsWith('>>')) {
      return {
        sprite: '',
        speaker: '',
        text: '',
        description: '',
        type: 'option',
        option: this.removeMarker(markerText, '>>'),
        depth,
      };
    }
    if (plain.startsWith('>')) {
      return {
        sprite: '',
        speaker: '',
        text: '',
        description: '',
        type: 'choice',
        prompt: this.removeMarker(markerText, '>'),
        depth,
      };
    }
    return {
      sprite,
      speaker,
      text: raw,
      description: '',
      type: depth > 0 ? 'option-line' : 'line',
      depth,
    };
  }

  private cellAt(sheet: XLSX.WorkSheet, column: number, row: number): XLSX.CellObject | undefined {
    const address = XLSX.utils.encode_cell({ c: column, r: row });
    return sheet[address];
  }

  private cellText(value: unknown): string {
    return value == null ? '' : String(value);
  }

  private richText(cell: XLSX.CellObject | undefined, fallback: unknown): string {
    const html = typeof cell?.h === 'string' ? cell.h : '';
    return html ? this.sanitizeRichText(html) : this.escape(this.cellText(fallback));
  }

  private sanitizeRichText(value: string): string {
    if (typeof DOMParser === 'undefined') {
      return this.escape(this.stripTags(value));
    }
    const document = new DOMParser().parseFromString(value, 'text/html');
    const allowedTags = new Set(['B', 'I', 'STRONG', 'EM', 'SPAN']);
    document.body.querySelectorAll('*').forEach((element) => {
      if (!allowedTags.has(element.tagName)) {
        element.replaceWith(...Array.from(element.childNodes));
        return;
      }
      Array.from(element.attributes).forEach((attribute) => {
        if (element.tagName !== 'SPAN' || attribute.name !== 'style') {
          element.removeAttribute(attribute.name);
        }
      });
      if (element.tagName === 'SPAN' && element.hasAttribute('style')) {
        const styles = element.getAttribute('style') ?? '';
        const safeStyles = styles
          .split(';')
          .map((style) => style.trim())
          .filter((style) =>
            /^(font-weight\s*:\s*(bold|[1-9]00)|font-style\s*:\s*italic|color\s*:\s*#[0-9a-f]{6})$/i.test(
              style,
            ),
          )
          .join(';');
        if (safeStyles) element.setAttribute('style', safeStyles);
        else element.removeAttribute('style');
      }
    });
    return document.body.innerHTML;
  }

  private decodeEntities(value: string): string {
    return value
      .replaceAll('&gt;', '>')
      .replaceAll('&lt;', '<')
      .replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&');
  }

  private stripTags(value: string): string {
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private removeMarker(value: string, marker: string): string {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return value.replace(new RegExp(`^((?:<[^>]+>)*)\\s*${escaped}\\s*`), '$1');
  }

  private removeLiteralMarker(value: string): string {
    return value.replace(/^((?:<[^>]+>)*)\s*\\>/, '$1>');
  }

  private escape(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
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
      if (line.type === 'image') {
        const node = {
          type: 'image',
          id: `imported-image-${index + 1}`,
          src: line.src ?? '',
        };
        const parentOption = [...options].reverse().find((item) => item.depth <= depth);
        if (parentOption) {
          parentOption.node.nodes.push(node);
        } else {
          nodes.push(node);
        }
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
        sprite: line.sprite?.trim() ?? '',
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
