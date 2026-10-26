import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { AuthService } from '../../services/auth.service';
import { GlossaryEntry, GlossaryInput, GlossaryService } from '../../services/glossary.service';
import { LanguageService } from '../../services/language.service';

type GlossaryDraft = GlossaryInput;
type GlossarySearchField = 'english' | 'chinese' | 'vietnamese' | 'detail' | 'note';

const GLOSSARY_SEARCH_FIELDS: GlossarySearchField[] = [
  'english',
  'chinese',
  'vietnamese',
  'detail',
  'note',
];

@Component({
  standalone: true,
  imports: [
    FormsModule,
    AccordionModule,
    ButtonModule,
    CheckboxModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    TextareaModule,
  ],
  templateUrl: './glossary.page.html',
})
export class GlossaryPage {
  public readonly language = inject(LanguageService);
  public readonly auth = inject(AuthService);

  private readonly glossary = inject(GlossaryService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  public entries: GlossaryEntry[] = [];
  public readonly searchFields = GLOSSARY_SEARCH_FIELDS;
  public search = '';
  public selectedSearchFields = new Set<GlossarySearchField>(GLOSSARY_SEARCH_FIELDS);
  public loading = true;
  public saving = false;
  public error = '';
  public dialogError = '';
  public status = '';
  public dialogVisible = false;
  public deleteMode = false;
  public selectedIds = new Set<string>();
  public editingEntry: GlossaryEntry | null = null;
  public draft: GlossaryDraft = this.emptyDraft();

  constructor() {
    void this.load();
  }

  public async load() {
    this.loading = true;
    this.error = '';
    try {
      this.entries = await this.glossary.list();
    } catch {
      this.error = this.language.text('glossaryLoadFailed');
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }

  public openAdd() {
    if (!this.auth.user()) return;
    this.error = '';
    this.dialogError = '';
    this.status = '';
    this.editingEntry = null;
    this.draft = this.emptyDraft();
    this.dialogVisible = true;
  }

  public openEdit(entry: GlossaryEntry) {
    if (!this.auth.user()) return;
    this.error = '';
    this.dialogError = '';
    this.status = '';
    this.editingEntry = entry;
    this.draft = {
      english: entry.english,
      chinese: entry.chinese,
      vietnamese: entry.vietnamese,
      detail: entry.detail,
      note: entry.note,
    };
    this.dialogVisible = true;
  }

  public toggleDeleteMode() {
    if (!this.auth.user()) return;
    this.deleteMode = !this.deleteMode;
    this.selectedIds = new Set<string>();
    this.error = '';
    this.status = '';
  }

  public toggleSelected(id: string) {
    const selected = new Set(this.selectedIds);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    this.selectedIds = selected;
  }

  public get filteredEntries(): GlossaryEntry[] {
    const query = this.search.trim().toLocaleLowerCase();
    if (!query) return this.entries;
    return this.entries.filter((entry) =>
      [...this.selectedSearchFields].some((field) =>
        entry[field].toLocaleLowerCase().includes(query),
      ),
    );
  }

  public isSearchFieldSelected(field: GlossarySearchField): boolean {
    return this.selectedSearchFields.has(field);
  }

  public toggleSearchField(field: GlossarySearchField) {
    const fields = new Set(this.selectedSearchFields);
    if (fields.has(field)) fields.delete(field);
    else fields.add(field);
    this.selectedSearchFields = fields;
  }

  public get allSearchFieldsSelected(): boolean {
    return this.selectedSearchFields.size === GLOSSARY_SEARCH_FIELDS.length;
  }

  public toggleAllSearchFields() {
    this.selectedSearchFields = this.allSearchFieldsSelected
      ? new Set<GlossarySearchField>()
      : new Set(GLOSSARY_SEARCH_FIELDS);
  }

  public closeAdd() {
    if (!this.saving) this.dialogVisible = false;
  }

  public async submit() {
    const input: GlossaryInput = {
      english: this.draft.english.trim(),
      chinese: this.draft.chinese.trim(),
      vietnamese: this.draft.vietnamese.trim(),
      detail: this.draft.detail.trim(),
      note: this.draft.note.trim(),
    };
    this.dialogError = '';
    this.status = '';
    if (!input.english || !input.vietnamese) {
      this.dialogError = this.language.text('glossaryRequired');
      return;
    }

    this.saving = true;
    try {
      const entry = this.editingEntry
        ? await this.glossary.update(this.editingEntry.id, input)
        : await this.glossary.create(input);
      this.entries = [...this.entries.filter((item) => item.id !== entry.id), entry].sort(
        (left, right) => left.english.localeCompare(right.english),
      );
      this.dialogVisible = false;
      this.status = this.language.text(this.editingEntry ? 'glossaryUpdated' : 'glossarySaved');
      this.editingEntry = null;
    } catch {
      this.dialogError = this.language.text(
        this.editingEntry ? 'glossaryUpdateFailed' : 'glossarySaveFailed',
      );
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }

  public deleteSelected() {
    if (!this.auth.user() || !this.selectedIds.size) return;
    const selectedIds = new Set(this.selectedIds);
    const selectedEntries = this.entries.filter((entry) => selectedIds.has(entry.id));
    this.confirmation.confirm({
      key: 'glossary-actions',
      header: this.language.text('deleteGlossaryTerms'),
      message: this.language.text('deleteGlossaryTermsMessage', {
        count: String(selectedEntries.length),
      }),
      icon: 'pi pi-trash',
      acceptLabel: this.language.text('delete'),
      rejectLabel: this.language.text('cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        this.error = '';
        this.status = '';
        try {
          const ids = selectedEntries.map((entry) => entry.id);
          await this.glossary.removeMany(ids);
          this.entries = this.entries.filter((entry) => !selectedIds.has(entry.id));
          this.selectedIds = new Set<string>();
          this.deleteMode = false;
          this.status = this.language.text('glossaryDeleted');
        } catch {
          this.error = this.language.text('glossaryDeleteFailed');
        } finally {
          this.changeDetector.markForCheck();
        }
      },
    });
  }

  private emptyDraft(): GlossaryDraft {
    return {
      english: '',
      chinese: '',
      vietnamese: '',
      detail: '',
      note: '',
    };
  }
}
