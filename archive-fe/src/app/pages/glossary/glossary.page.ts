import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { AccordionModule } from 'primeng/accordion';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { AuthService } from '../../services/auth.service';
import {
  GlossaryEntry,
  GlossaryInput,
  GlossaryService,
  GlossaryTag,
  GlossaryTagInput,
} from '../../services/glossary.service';
import { LanguageService } from '../../services/language.service';

type GlossaryDraft = GlossaryInput;
type GlossarySearchField = 'english' | 'chinese' | 'vietnamese' | 'detail' | 'note';
type GlossaryTagDraft = GlossaryTagInput;

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
    BreadcrumbModule,
    ButtonModule,
    CheckboxModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    MultiSelectModule,
    TagModule,
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
  public tags: GlossaryTag[] = [];
  public readonly breadcrumbHome: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  public get breadcrumbItems(): MenuItem[] {
    return [{ label: this.language.text('glossary') }];
  }
  public readonly searchFields = GLOSSARY_SEARCH_FIELDS;
  public search = '';
  public selectedSearchFields = new Set<GlossarySearchField>(GLOSSARY_SEARCH_FIELDS);
  public selectedTagIds: string[] = [];
  public loading = true;
  public saving = false;
  public error = '';
  public dialogError = '';
  public status = '';
  public dialogVisible = false;
  public tagDialogVisible = false;
  public deleteMode = false;
  public selectedIds = new Set<string>();
  public editingEntry: GlossaryEntry | null = null;
  public editingTag: GlossaryTag | null = null;
  public draft: GlossaryDraft = this.emptyDraft();
  public tagDraft: GlossaryTagDraft = this.emptyTagDraft();

  constructor() {
    void this.load();
  }

  public async load() {
    this.loading = true;
    this.error = '';
    try {
      [this.entries, this.tags] = await Promise.all([
        this.glossary.list(),
        this.glossary.listTags(),
      ]);
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
      tagIds: entry.tags.map((tag) => tag.id),
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
    const selectedTagIds = new Set(this.selectedTagIds);

    return this.entries.filter((entry) => {
      const matchesText =
        !query ||
        [...this.selectedSearchFields].some((field) =>
          entry[field].toLocaleLowerCase().includes(query),
        );
      const entryTagIds = new Set(entry.tags.map((tag) => tag.id));
      const matchesTags =
        !selectedTagIds.size || [...selectedTagIds].every((tagId) => entryTagIds.has(tagId));
      return matchesText && matchesTags;
    });
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
      tagIds: this.draft.tagIds,
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

  public openTagManager() {
    if (!this.auth.user()) return;
    this.editingTag = null;
    this.tagDraft = this.emptyTagDraft();
    this.dialogError = '';
    this.tagDialogVisible = true;
  }

  public editTag(tag: GlossaryTag) {
    if (!this.auth.user()) return;
    this.editingTag = tag;
    this.tagDraft = { name: tag.name };
    this.dialogError = '';
    this.tagDialogVisible = true;
  }

  public async saveTag() {
    const input = { name: this.tagDraft.name.trim() };
    if (!input.name) {
      this.dialogError = this.language.text('glossaryTagRequired');
      return;
    }
    this.saving = true;
    this.dialogError = '';
    try {
      const tag = this.editingTag
        ? await this.glossary.updateTag(this.editingTag.id, input)
        : await this.glossary.createTag(input);
      this.tags = [...this.tags.filter((item) => item.id !== tag.id), tag].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      this.entries = this.entries.map((entry) => ({
        ...entry,
        tags: entry.tags.map((item) => (item.id === tag.id ? tag : item)),
      }));
      this.tagDialogVisible = false;
      this.editingTag = null;
    } catch {
      this.dialogError = this.language.text('glossaryTagSaveFailed');
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }

  public deleteTag(tag: GlossaryTag) {
    if (!this.auth.user()) return;
    this.confirmation.confirm({
      key: 'glossary-actions',
      header: this.language.text('deleteGlossaryTag'),
      message: this.language.text('deleteGlossaryTagMessage', { name: tag.name }),
      icon: 'pi pi-trash',
      acceptLabel: this.language.text('delete'),
      rejectLabel: this.language.text('cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        try {
          await this.glossary.removeTag(tag.id);
          this.tags = this.tags.filter((item) => item.id !== tag.id);
          this.entries = this.entries.map((entry) => ({
            ...entry,
            tags: entry.tags.filter((item) => item.id !== tag.id),
          }));
        } catch {
          this.error = this.language.text('glossaryTagDeleteFailed');
        } finally {
          this.changeDetector.markForCheck();
        }
      },
    });
  }

  public tagOptions() {
    return this.tags.map((tag) => ({ label: tag.name, value: tag.id }));
  }

  private emptyDraft(): GlossaryDraft {
    return {
      english: '',
      chinese: '',
      vietnamese: '',
      detail: '',
      note: '',
      tagIds: [],
    };
  }

  private emptyTagDraft(): GlossaryTagDraft {
    return { name: '' };
  }
}
