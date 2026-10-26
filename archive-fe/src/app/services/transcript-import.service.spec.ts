import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';
import { TranscriptImportService } from './transcript-import.service';

describe('TranscriptImportService', () => {
  const importer = new TranscriptImportService();

  function workbookFile(rows: unknown[][]): File {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Transcript');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new File([buffer], 'transcript.xlsx');
  }

  async function parse(rows: unknown[][], language?: string) {
    return firstValueFrom(importer.parseXlsx(workbookFile(rows), language));
  }

  it('uses the speaker column matching the selected language', async () => {
    const rows = [
      ['Type', 'Depth', 'English Speaker', 'Vietnamese Speaker', 'English', 'Vietnamese'],
      ['line', 0, 'Alice', 'Lan', 'Hello.', 'Xin chào.'],
    ];

    const english = await parse(rows, 'english');
    const vietnamese = await parse(rows, 'vietnamese');

    expect(english.lines[0].speaker).toBe('Alice');
    expect(vietnamese.lines[0].speaker).toBe('Lan');
  });

  it('accepts the speaker-first language column format', async () => {
    const result = await parse(
      [
        ['Type', 'Depth', 'Speaker English', 'Speaker Vietnamese', 'English', 'Vietnamese'],
        ['line', 0, 'Alice', 'Lan', 'Hello.', 'Xin chào.'],
      ],
      'vietnamese',
    );

    expect(result.lines[0].speaker).toBe('Lan');
  });

  it('uses the legacy shared speaker column when no language-specific value exists', async () => {
    const result = await parse(
      [
        ['Speaker', 'Type', 'Depth', 'English', 'Vietnamese'],
        ['Narrator', 'line', 0, 'Hello.', 'Xin chào.'],
      ],
      'vietnamese',
    );

    expect(result.lines[0].speaker).toBe('Narrator');
  });

  it('leaves the speaker blank when the selected language has no speaker column', async () => {
    const result = await parse(
      [
        ['Type', 'Depth', 'English Speaker', 'English', 'Vietnamese'],
        ['line', 0, 'Alice', 'Hello.', 'Xin chào.'],
      ],
      'vietnamese',
    );

    expect(result.lines[0].speaker).toBe('');
  });

  it('rejects a speaker column without a matching language column', async () => {
    await expect(
      parse([
        ['Type', 'Depth', 'Spanish Speaker', 'English'],
        ['line', 0, 'Alice', 'Hello.'],
      ]),
    ).rejects.toThrow('Speaker column must use a language with a content column: spanish');
  });
});
