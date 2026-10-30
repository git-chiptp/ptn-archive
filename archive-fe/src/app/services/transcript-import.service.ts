import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { defer, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { DialogueNode, LineNode, LineOption } from '../models/transcript.models';
import { parseYoutubeVideoId } from '../utils/youtube';

export interface ImportedLine {
  sprite?: string;
  src?: string;
  speaker: string;
  text: string;
  male?: string;
  female?: string;
  description: string;
  type: 'line' | 'option' | 'image' | 'video';
  depth: number;
}

export interface ImportLanguageOption {
  key: string;
  label: string;
}

export interface ImportedTranscriptMetadata {
  stage?: string;
  name?: string;
  description?: string;
}

export interface TranscriptImportResult {
  lines: ImportedLine[];
  languages: ImportLanguageOption[];
  selectedLanguage: string;
  metadata: ImportedTranscriptMetadata;
}

type ImportMetadataField = keyof ImportedTranscriptMetadata;

type ImportColumns = {
  type: number;
  depth: number;
  speakers: { languageKey: string; index: number }[];
  sprite?: number;
  languages: { key: string; label: string; index: number }[];
  metadata: {
    languageKey: string;
    field: ImportMetadataField;
    index: number;
  }[];
};

type ImportedFontStyle = {
  bold?: boolean;
  italic?: boolean;
  color?: string;
};

type ImportedFontStyles = Map<string, ImportedFontStyle>;

type WorkbookWithFiles = XLSX.WorkBook & {
  files?: Record<string, { content?: unknown }>;
  Styles?: {
    CellXf?: unknown[];
    Fonts?: unknown[];
  };
};

@Injectable({ providedIn: 'root' })
export class TranscriptImportService {
  public parseXlsx(
    file: File,
    languageOrProgress?: string | ((progress: number) => void),
    onProgress?: (progress: number) => void,
  ) {
    const language = typeof languageOrProgress === 'string' ? languageOrProgress : undefined;
    const progress = typeof languageOrProgress === 'function' ? languageOrProgress : onProgress;
    return defer(() => {
      progress?.(5);
      return from(file.arrayBuffer());
    }).pipe(
      map((buffer): TranscriptImportResult => {
        progress?.(35);
        const workbook = XLSX.read(buffer, {
          cellHTML: true,
          cellStyles: true,
          cellFormula: false,
          bookFiles: true,
        }) as WorkbookWithFiles;
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          progress?.(100);
          return { lines: [], languages: [], selectedLanguage: '', metadata: {} };
        }
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: '',
          raw: false,
        });
        const imported = this.parseRows(rows, sheet, language, workbook);
        progress?.(100);
        return imported;
      }),
    );
  }

  private parseRows(
    rows: unknown[][],
    sheet: XLSX.WorkSheet,
    language: string | undefined,
    workbook: WorkbookWithFiles,
  ): TranscriptImportResult {
    if (!rows.length) {
      return { lines: [], languages: [], selectedLanguage: '', metadata: {} };
    }
    const columns = this.importColumns(rows[0]);
    const selectedLanguage =
      columns.languages.find((item) => item.key === language)?.key ?? columns.languages[0].key;
    const selectedColumn = columns.languages.find((item) => item.key === selectedLanguage);
    if (!selectedColumn) {
      throw new Error('Import requires at least one language column.');
    }
    const fontStyles = this.fontStyles(workbook, selectedColumn.index);
    const imported: ImportedLine[] = [];
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index] ?? [];
      if (!row.some((value) => this.cellText(value).trim())) {
        continue;
      }
      imported.push(this.parseRow(row, index, sheet, columns, selectedColumn, fontStyles));
    }
    return {
      lines: imported,
      languages: columns.languages.map(({ key, label }) => ({ key, label })),
      selectedLanguage,
      metadata: this.readMetadata(rows, sheet, columns, selectedLanguage),
    };
  }

  private importColumns(header: unknown[]): ImportColumns {
    const indexes = new Map<string, number>();
    const headers = header
      .map((value, index) => ({
        index,
        key: this.normalizeHeader(value),
        label: this.cellText(value).trim(),
      }))
      .filter((item) => item.key);
    headers.forEach((item) => {
      if (indexes.has(item.key)) {
        throw new Error(`Import column headers must be unique: ${item.label}.`);
      }
      indexes.set(item.key, item.index);
    });
    const required = (name: string): number => {
      const index = indexes.get(name);
      if (index === undefined) {
        throw new Error(`Import requires a ${name} column.`);
      }
      return index;
    };
    const optional = (name: string): number | undefined => indexes.get(name);
    const languageSpeakers = headers
      .map((item) => ({ ...item, languageKey: this.parseSpeakerHeader(item.key) }))
      .filter((item): item is typeof item & { languageKey: string } => !!item.languageKey);
    const languageSpeakerKeys = new Set(languageSpeakers.map((item) => item.key));
    const structural = new Set(['sprite', 'type', 'depth', ...languageSpeakerKeys]);
    const metadata: ImportColumns['metadata'] = [];
    const bareMetadata: { field: ImportMetadataField; index: number; label: string }[] = [];
    const languageHeaders = headers
      .filter((item) => !structural.has(item.key))
      .filter((item) => {
        const parsed = this.parseMetadataHeader(item.key);
        if (parsed) {
          metadata.push({ ...parsed, index: item.index });
          return false;
        }
        const field = this.parseBareMetadataHeader(item.key);
        if (field) {
          bareMetadata.push({ field, index: item.index, label: item.label });
          return false;
        }
        return true;
      });
    const languages = languageHeaders.map((item) => ({
      key: item.key,
      label: item.label,
      index: item.index,
    }));
    if (!languages.length) {
      throw new Error('Import requires at least one language column.');
    }
    bareMetadata.forEach((item) =>
      metadata.push({ languageKey: '*', field: item.field, index: item.index }),
    );
    languageSpeakers.forEach((item) => {
      if (!languages.some((language) => language.key === item.languageKey)) {
        throw new Error(
          `Speaker column must use a language with a content column: ${item.languageKey}.`,
        );
      }
      if (languageSpeakers.filter((speaker) => speaker.languageKey === item.languageKey).length > 1) {
        throw new Error(`Import has multiple speaker columns for ${item.languageKey}.`);
      }
    });
    metadata.forEach((item) => {
      if (item.languageKey !== '*' && !languages.some((language) => language.key === item.languageKey)) {
        throw new Error(
          `Metadata column must use a language with a content column: ${item.languageKey}.`,
        );
      }
    });

    return {
      type: required('type'),
      depth: required('depth'),
      speakers: languageSpeakers.map(({ languageKey, index }) => ({ languageKey, index })),
      sprite: optional('sprite'),
      languages,
      metadata,
    };
  }

  private parseSpeakerHeader(key: string): string | undefined {
    const parts = key.split(' ');
    if (parts.length < 2) {
      return undefined;
    }
    if (parts.at(-1) === 'speaker') {
      return parts.slice(0, -1).join(' ');
    }
    if (parts[0] === 'speaker') {
      return parts.slice(1).join(' ');
    }
    return undefined;
  }

  private parseMetadataHeader(
    key: string,
  ): { languageKey: string; field: ImportMetadataField } | undefined {
    if (this.parseBareMetadataHeader(key) !== undefined) {
      return undefined;
    }
    const parts = key.split(' ');
    const aliases: { tokens: string[]; field: ImportMetadataField }[] = [
      { tokens: ['stage', 'number'], field: 'stage' },
      { tokens: ['stage', 'no'], field: 'stage' },
      { tokens: ['stage', 'name'], field: 'name' },
      { tokens: ['stage'], field: 'stage' },
      { tokens: ['name'], field: 'name' },
      { tokens: ['description'], field: 'description' },
    ];
    for (const alias of aliases) {
      const suffix = parts.slice(-alias.tokens.length);
      if (
        parts.length > alias.tokens.length &&
        suffix.every((token, index) => token === alias.tokens[index])
      ) {
        return {
          languageKey: parts.slice(0, -alias.tokens.length).join(' '),
          field: alias.field,
        };
      }
      const prefix = parts.slice(0, alias.tokens.length);
      if (
        parts.length > alias.tokens.length &&
        prefix.every((token, index) => token === alias.tokens[index])
      ) {
        return {
          languageKey: parts.slice(alias.tokens.length).join(' '),
          field: alias.field,
        };
      }
    }
    return undefined;
  }

  private parseBareMetadataHeader(key: string): ImportMetadataField | undefined {
    const parts = key.split(' ');
    const aliases: { tokens: string[]; field: ImportMetadataField }[] = [
      { tokens: ['stage', 'number'], field: 'stage' },
      { tokens: ['stage', 'no'], field: 'stage' },
      { tokens: ['stage', 'name'], field: 'name' },
      { tokens: ['stage'], field: 'stage' },
      { tokens: ['name'], field: 'name' },
      { tokens: ['description'], field: 'description' },
    ];
    return aliases.find(
      (alias) =>
        alias.tokens.length === parts.length &&
        alias.tokens.every((token, index) => token === parts[index]),
    )?.field;
  }

  private readMetadata(
    rows: unknown[][],
    sheet: XLSX.WorkSheet,
    columns: ImportColumns,
    languageKey: string,
  ): ImportedTranscriptMetadata {
    const metadata: ImportedTranscriptMetadata = {};
    columns.metadata
      .filter((item) => item.languageKey === languageKey || item.languageKey === '*')
      .forEach((item) => {
        for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
          const value = this.stripTags(
            this.decodeEntities(
              this.richText(
                this.cellAt(sheet, item.index, rowIndex),
                rows[rowIndex]?.[item.index],
              ),
            ),
          ).trim();
          if (value) {
            metadata[item.field] = value;
            break;
          }
        }
      });
    return metadata;
  }

  private parseRow(
    row: unknown[],
    rowIndex: number,
    sheet: XLSX.WorkSheet,
    columns: ImportColumns,
    language: { key: string; index: number },
    fontStyles: ImportedFontStyles,
  ): ImportedLine {
    const address = this.cellAddress(language.index, rowIndex);
    const cellStyle = fontStyles.get(address);
    const richText = this.richText(this.cellAt(sheet, language.index, rowIndex), row[language.index]);
    const text = cellStyle ? this.applyFontStyle(richText, cellStyle) : richText;
    const type = this.parseType(row[columns.type], rowIndex);
    const depth = this.parseDepth(row[columns.depth], rowIndex);
    const languageSpeaker = columns.speakers.find((item) => item.languageKey === language.key);
    const speaker = languageSpeaker ? this.cellText(row[languageSpeaker.index]).trim() : '';
    const sprite = columns.sprite === undefined ? '' : this.cellText(row[columns.sprite]).trim();

    if (type === 'image') {
      const imageValue = this.stripTags(this.decodeEntities(sprite)).trim();
      const variants = this.parseVariants(imageValue);
      if (!imageValue) {
        throw new Error(`Row ${rowIndex + 1}: image rows require an image value in Sprite.`);
      }
      return {
        sprite: '',
        src: variants?.male ?? variants?.female ?? imageValue,
        male: variants?.male,
        female: variants?.female,
        speaker: '',
        text: '',
        description: '',
        type,
        depth,
      };
    }

    if (type === 'video') {
      const videoValue = this.stripTags(this.decodeEntities(text)).trim();
      if (!parseYoutubeVideoId(videoValue)) {
        throw new Error(`Row ${rowIndex + 1}: video rows require a valid YouTube URL or video ID.`);
      }
      return {
        sprite: '',
        speaker: '',
        text: videoValue,
        description: '',
        type,
        depth,
      };
    }

    if (type === 'option') {
      return {
        sprite: '',
        speaker: '',
        text,
        description: '',
        type,
        depth,
      };
    }

    const variants = this.parseVariants(richText, cellStyle);
    if (variants) {
      return {
        sprite,
        speaker,
        text: variants.male ?? variants.female ?? '',
        male: variants.male,
        female: variants.female,
        description: '',
        type,
        depth,
      };
    }

    return {
      sprite,
      speaker,
      text,
      description: '',
      type,
      depth,
    };
  }

  private parseType(value: unknown, rowIndex: number): ImportedLine['type'] {
    const type = this.cellText(value)
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-');
    if (type === 'line' || type === 'option' || type === 'image' || type === 'video') {
      return type;
    }
    throw new Error(`Row ${rowIndex + 1}: Type must be line, option, image, or video.`);
  }

  private parseDepth(value: unknown, rowIndex: number): number {
    const text = this.cellText(value).trim();
    const depth = Number(text);
    if (!text || !Number.isInteger(depth) || depth < 0) {
      throw new Error(`Row ${rowIndex + 1}: Depth must be a non-negative whole number.`);
    }
    return depth;
  }

  private normalizeHeader(value: unknown): string {
    return this.cellText(value)
      .trim()
      .toLowerCase()
      .replace(/[–—-]+/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseVariants(
    value: string,
    cellStyle?: ImportedFontStyle,
  ): { male?: string; female?: string } | undefined {
    const lines = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const plainLines = lines.map((line) => this.stripTags(this.decodeEntities(line)).trim());
    if (!plainLines.length || plainLines.some((line) => !/^(male|female)\s*:/i.test(line))) {
      return undefined;
    }

    const variants: { male?: string; female?: string } = {};
    for (const [index, plainLine] of plainLines.entries()) {
      const match = /^(male|female)\s*:\s*(.*)$/i.exec(plainLine);
      if (!match) {
        return undefined;
      }
      const key = match[1].toLowerCase() as 'male' | 'female';
      const variant = this.removeVariantPrefix(lines[index], match[1]).trim();
      if (variant) {
        variants[key] = cellStyle ? this.applyFontStyle(variant, cellStyle) : variant;
      }
    }
    return variants.male || variants.female ? variants : undefined;
  }

  private removeVariantPrefix(value: string, label: string): string {
    if (typeof DOMParser === 'undefined') {
      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return value.replace(
        new RegExp(`^\\s*${escapedLabel}\\s*:\\s*`, 'i'),
        '',
      );
    }
    const document = new DOMParser().parseFromString(`<root>${value}</root>`, 'text/html');
    const root = document.body.firstElementChild;
    if (!root) {
      return value;
    }
    const prefix = new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*`, 'i');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    let remaining = true;
    while (textNode && remaining) {
      const node = textNode as Text;
      const match = prefix.exec(node.data);
      if (match) {
        node.data = node.data.slice(match[0].length);
        remaining = false;
      } else if (node.data.trim()) {
        remaining = false;
      }
      textNode = walker.nextNode();
    }
    return root.innerHTML;
  }

  private cellAt(sheet: XLSX.WorkSheet, column: number, row: number): XLSX.CellObject | undefined {
    const address = XLSX.utils.encode_cell({ c: column, r: row });
    return sheet[address];
  }

  private cellAddress(column: number, row: number): string {
    return XLSX.utils.encode_cell({ c: column, r: row });
  }

  private cellText(value: unknown): string {
    return value == null ? '' : String(value);
  }

  private richText(
    cell: XLSX.CellObject | undefined,
    fallback: unknown,
    fontStyles: ImportedFontStyles = new Map(),
    address?: string,
  ): string {
    const style = address ? fontStyles.get(address) : undefined;
    const runs = typeof cell?.r === 'string' ? this.richTextRuns(cell.r) : '';
    if (runs) {
      const sanitized = this.sanitizeRichText(runs);
      return style ? this.applyFontStyle(sanitized, style) : sanitized;
    }
    const html = typeof cell?.h === 'string' ? cell.h : '';
    if (html) {
      const sanitized = this.sanitizeRichText(html);
      return style ? this.applyFontStyle(sanitized, style) : sanitized;
    }
    const text = this.escape(this.cellText(fallback));
    return style ? this.applyFontStyle(text, style) : text;
  }

  private richTextRuns(value: string): string {
    if (typeof DOMParser === 'undefined') {
      return '';
    }
    const document = new DOMParser().parseFromString(`<root>${value}</root>`, 'application/xml');
    if (document.querySelector('parsererror')) {
      return '';
    }
    return Array.from(document.documentElement.children)
      .filter((run) => run.localName === 'r')
      .map((run) => {
        const text = Array.from(run.children)
          .filter((element) => element.localName === 't')
          .map((element) => element.textContent ?? '')
          .join('')
          .replace(/\r\n?/g, '\n');
        if (!text) {
          return '';
        }
        const style = this.fontStyleFromProperties(
          Array.from(run.children).find((element) => element.localName === 'rPr'),
        );
        return this.applyFontStyle(this.escape(text), style);
      })
      .join('');
  }

  private fontStyleFromProperties(element?: Element): ImportedFontStyle {
    if (!element) {
      return {};
    }
    const color = Array.from(element.children).find((child) => child.localName === 'color');
    return {
      bold: Array.from(element.children).some(
        (child) => child.localName === 'b' && child.getAttribute('val') !== '0',
      ),
      italic: Array.from(element.children).some(
        (child) => child.localName === 'i' && child.getAttribute('val') !== '0',
      ),
      color: this.excelColor(color?.getAttribute('rgb') ?? undefined),
    };
  }

  private applyFontStyle(value: string, style: ImportedFontStyle): string {
    let result = value;
    if (style.color) {
      result = `<span style="color:${style.color}">${result}</span>`;
    }
    if (style.italic) {
      result = `<em>${result}</em>`;
    }
    if (style.bold) {
      result = `<strong>${result}</strong>`;
    }
    return result;
  }

  private fontStyles(workbook: WorkbookWithFiles, column: number): ImportedFontStyles {
    const styles = workbook.Styles;
    const cellXfs = styles?.CellXf ?? [];
    const fonts = styles?.Fonts ?? [];
    const result: ImportedFontStyles = new Map();
    const sheetXml = workbook.files?.['xl/worksheets/sheet1.xml']?.content;
    const xml =
      typeof sheetXml === 'string'
        ? sheetXml
        : sheetXml instanceof Uint8Array
          ? new TextDecoder().decode(sheetXml)
          : '';
    if (!xml) {
      return result;
    }
    const columnName = XLSX.utils.encode_col(column);
    const cells =
      xml.match(new RegExp(`<c\\b[^>]*\\br="${columnName}[0-9]+"[^>]*>`, 'g')) ?? [];
    cells.forEach((tag) => {
      const address = tag.match(/\br="([A-Z]+[0-9]+)"/)?.[1];
      const styleIndex = Number(tag.match(/\bs="(\d+)"/)?.[1]);
      if (!address || !Number.isInteger(styleIndex)) {
        return;
      }
      const cellXf = cellXfs[styleIndex] as { fontId?: number } | undefined;
      const font = cellXf && fonts[cellXf.fontId ?? -1];
      const style = this.fontStyleFromObject(font);
      if (style.bold || style.italic || style.color) {
        result.set(address, style);
      }
    });
    return result;
  }

  private fontStyleFromObject(value: unknown): ImportedFontStyle {
    if (!value || typeof value !== 'object') {
      return {};
    }
    const font = value as {
      bold?: boolean | number;
      italic?: boolean | number;
      color?: { rgb?: string };
    };
    return {
      bold: Boolean(font.bold),
      italic: Boolean(font.italic),
      color: this.excelColor(font.color?.rgb),
    };
  }

  private excelColor(value?: string): string | undefined {
    const color = value?.replace(/^#/, '').trim();
    if (!color || !/^[0-9a-f]{6,8}$/i.test(color)) {
      return undefined;
    }
    return `#${color.slice(-6).toUpperCase()}`;
  }

  private sanitizeRichText(value: string): string {
    if (typeof DOMParser === 'undefined') {
      return this.escape(this.stripTags(value));
    }
    const document = new DOMParser().parseFromString(value, 'text/html');
    document.body.querySelectorAll('br').forEach((element) => {
      element.replaceWith(document.createTextNode('\n'));
    });
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
      .replace(/<br\s*\/?>(?=\s*\n?)/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .trim();
  }

  private escape(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  public toNodes(lines: ImportedLine[]): DialogueNode[] {
    const nodes: DialogueNode[] = [];
    const activeLines = new Map<number, LineNode>();
    const activeOptions = new Map<number, LineOption>();

    lines.forEach((line, index) => {
      const depth = line.depth;
      if (line.type === 'option') {
        for (const activeDepth of [...activeLines.keys()]) {
          if (activeDepth > depth) activeLines.delete(activeDepth);
        }
        for (const activeDepth of [...activeOptions.keys()]) {
          if (activeDepth >= depth) activeOptions.delete(activeDepth);
        }

        const parentLine = [...activeLines.entries()]
          .filter(([activeDepth]) => activeDepth <= depth)
          .sort(([left], [right]) => right - left)[0]?.[1];
        if (!parentLine) {
          throw new Error(
            `Row ${index + 2}: option has no line parent at the same or lower depth.`,
          );
        }
        parentLine.options ??= [];
        const option: LineOption = {
          id: `imported-option-${index + 1}`,
          label: line.text,
          nodes: [],
        };
        parentLine.options.push(option);
        activeOptions.set(depth, option);
        return;
      }

      for (const activeDepth of [...activeLines.keys()]) {
        if (activeDepth >= depth) activeLines.delete(activeDepth);
      }
      for (const activeDepth of [...activeOptions.keys()]) {
        if (activeDepth >= depth) activeOptions.delete(activeDepth);
      }

      const node: DialogueNode =
        line.type === 'image'
          ? {
              type: 'image',
              id: `imported-image-${index + 1}`,
              src: line.src ?? '',
              ...(line.male || line.female
                ? { variants: { male: line.male, female: line.female } }
                : {}),
            }
          : line.type === 'video'
            ? {
                type: 'video',
                id: `imported-video-${index + 1}`,
                videoId: parseYoutubeVideoId(line.text) ?? '',
              }
            : {
              type: 'line',
              id: `imported-${index + 1}`,
              speaker: line.speaker,
              sprite: line.sprite?.trim() ?? '',
              text: line.text || line.description,
              description: line.description || undefined,
              ...(line.male || line.female
                ? {
                    variants: {
                      male: line.male || line.text,
                      female: line.female || line.text,
                    },
                  }
                : {}),
            };
      const parentOption = [...activeOptions.entries()]
        .filter(([activeDepth]) => activeDepth < depth)
        .sort(([left], [right]) => right - left)[0]?.[1];
      if (parentOption) {
        parentOption.nodes.push(node);
      } else {
        nodes.push(node);
      }
      if (node.type === 'line') activeLines.set(depth, node);
    });
    return nodes;
  }
}
