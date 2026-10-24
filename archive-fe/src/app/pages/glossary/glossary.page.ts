import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../services/auth.service';
import { GlossaryEntry, GlossaryInput, GlossaryService } from '../../services/glossary.service';
import { LanguageService } from '../../services/language.service';

type GlossaryDraft = GlossaryInput;

@Component({
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule],
  templateUrl: './glossary.page.html',
})
export class GlossaryPage {
  public readonly language = inject(LanguageService);
  public readonly auth = inject(AuthService);

  private readonly glossary = inject(GlossaryService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  public entries: GlossaryEntry[] = [];
  public loading = true;
  public saving = false;
  public error = '';
  public dialogError = '';
  public status = '';
  public dialogVisible = false;
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
    this.draft = this.emptyDraft();
    this.dialogVisible = true;
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
      const entry = await this.glossary.create(input);
      this.entries = [...this.entries, entry].sort((left, right) =>
        left.english.localeCompare(right.english),
      );
      this.dialogVisible = false;
      this.status = this.language.text('glossarySaved');
    } catch {
      this.dialogError = this.language.text('glossarySaveFailed');
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
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
