import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';
import {
  Category,
  ChoiceNode,
  DialogueNode,
  LineNode,
  Transcript,
} from '../../models/transcript.models';
import {
  NodeEditorComponent,
  EditableNode,
} from '../../components/transcript/node-editor.component';
import { ArchiveStore } from '../../services/archive.store';
import { LanguageCode, LanguageService } from '../../services/language.service';
import { ImportedLine, TranscriptImportService } from '../../services/transcript-import.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, NodeEditorComponent],
  templateUrl: './admin.page.html',
})
export class AdminPage {
  private store = inject(ArchiveStore);

  private cdr = inject(ChangeDetectorRef);

  private importer = inject(TranscriptImportService);

  private route = inject(ActivatedRoute);

  readonly languages = inject(LanguageService);

  public published = false;

  public importMessage = '';

  public editingId: string | null = null;

  public form = {
    category: 'main-story' as Category,
    language: 'en' as LanguageCode,
    parentLabel: '',
    stageLabel: '',
  };

  public nodes: EditableNode[] = [this.newLine()];

  public pendingImportNodes: EditableNode[] = [];

  public pendingImportName = '';

  public pendingImportReady = false;

  public importLoading = false;

  public importError = false;

  constructor() {
    const chapterName = this.route.snapshot.queryParamMap.get('chapterName');

    const eventName = this.route.snapshot.queryParamMap.get('eventName');

    const category = this.route.snapshot.queryParamMap.get('category');

    const parentLabel = this.route.snapshot.queryParamMap.get('parentLabel');

    const stageLabel = this.route.snapshot.queryParamMap.get('stageLabel');

    if (chapterName) {
      this.form.parentLabel = chapterName;
    }

    if (eventName) {
      this.form.parentLabel = eventName;
    }

    if (parentLabel) {
      this.form.parentLabel = parentLabel;
    }

    if (stageLabel) {
      this.form.stageLabel = stageLabel;
    }

    if (category === 'event-story' || category === 'perspectra') {
      this.form.category = category;
    }
  }

  public get transcripts() {
    return this.store.transcripts();
  }

  public get parentChoices() {
    const category = this.form.category;
    if (category !== 'main-story' && category !== 'event-story') {
      return [];
    }
    const choices = this.store
      .chapters()
      .filter((item) => (item.category ?? 'main-story') === category)
      .map((item) => ({ id: item.id, name: item.name }));
    if (this.form.parentLabel && !choices.some((item) => item.name === this.form.parentLabel)) {
      choices.unshift({ id: '', name: this.form.parentLabel });
    }
    return choices;
  }

  private newLine(): EditableNode {
    return {
      type: 'line',
      id: crypto.randomUUID(),
      speaker: '',
      text: '',
      male: '',
      female: '',
    };
  }

  public edit(transcript: Transcript) {
    this.editingId = transcript.id;
    this.form = {
      category: transcript.category,
      language: transcript.sourceLanguage ?? 'en',
      parentLabel: transcript.parentLabel,
      stageLabel: transcript.stageLabel,
    };
    this.nodes = this.toEditable(transcript.nodes);
    this.published = false;
  }

  public cancelEdit() {
    this.editingId = null;
    this.form = { category: 'main-story', language: 'en', parentLabel: '', stageLabel: '' };
    this.nodes = [this.newLine()];
  }

  public delete(transcript: Transcript) {
    if (confirm(`Delete "${transcript.parentLabel} / ${transcript.stageLabel}"?`)) {
      this.store.remove(transcript.id);
      if (this.editingId === transcript.id) {
        this.cancelEdit();
      }
    }
  }

  public importFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.pendingImportNodes = [];
    this.pendingImportName = '';
    this.pendingImportReady = false;
    this.importLoading = false;
    this.importError = false;
    if (!/\.xlsx$/i.test(file.name)) {
      this.importError = true;
      this.importMessage = 'Import failed: choose an XLSX file exported from Excel.';
      return;
    }
    this.importLoading = true;
    this.importMessage = 'Uploading XLSX file...';
    this.importer
      .parseXlsx(file)
      .pipe(
        finalize(() => {
          this.importLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (imported) => {
          this.pendingImportNodes = this.toEditable(this.importer.toNodes(imported));
          this.pendingImportName = file.name;
          this.pendingImportReady = this.pendingImportNodes.length > 0;
          this.importError = this.pendingImportNodes.length === 0;
          this.importMessage = this.pendingImportNodes.length
            ? this.pendingImportNodes.length + ' lines ready to import.'
            : 'Import failed: no transcript rows found.';
          this.cdr.markForCheck();
        },
        error: () => {
          this.pendingImportNodes = [];
          this.pendingImportName = '';
          this.pendingImportReady = false;
          this.importError = true;
          this.importMessage = 'Import failed: the backend could not parse the XLSX file.';
          this.cdr.markForCheck();
        },
      });
  }
  importPending() {
    if (!this.pendingImportReady || !this.pendingImportNodes.length) {
      return;
    }

    if (
      this.editorHasContent() &&
      !confirm(
        'Importing this file will replace all current transcript lines and choices. Continue?',
      )
    ) {
      return;
    }

    this.nodes = this.pendingImportNodes;
    this.pendingImportNodes = [];
    this.pendingImportReady = false;
    this.pendingImportName = '';
    this.importMessage = 'Imported ' + this.nodes.length + ' lines into the editor.';
  }
  private editorHasContent() {
    return this.nodes.some((node) =>
      node.type === 'line'
        ? !!(node.speaker || node.text || node.male || node.female)
        : !!(node.prompt || node.options.some((option) => option.label || option.nodes.length)),
    );
  }

  public submit(formRef: NgForm) {
    if (formRef.invalid || !this.nodes.length) {
      return;
    }
    const helper = new NodeEditorComponent();
    helper.nodes = this.nodes;
    const current: Transcript = {
      id: this.editingId ?? crypto.randomUUID(),
      title: this.form.stageLabel,
      category: this.form.category,
      parentId: this.form.parentLabel.toLowerCase().replaceAll(' ', '-'),
      parentLabel: this.form.parentLabel,
      stageLabel: this.form.stageLabel,
      description: '',
      nodes: helper.serialize(),
      sourceLanguage: this.form.language,
    };
    if (
      this.editingId &&
      this.form.language !==
        (this.transcripts.find((item) => item.id === this.editingId)?.sourceLanguage ?? 'en')
    ) {
      this.store.saveTranslation(this.editingId, this.form.language, {
        title: current.title,
        description: current.description,
        parentLabel: current.parentLabel,
        stageLabel: current.stageLabel,
        nodes: current.nodes,
      });
    } else if (this.editingId) {
      this.store.update(current);
    } else {
      this.store.add(current);
    }
    this.published = true;
    this.cancelEdit();
  }
  private toEditable(nodes: DialogueNode[]): EditableNode[] {
    return nodes.map((node) => (node.type === 'line' ? this.line(node) : this.choice(node)));
  }
  private line(node: LineNode): EditableNode {
    return {
      type: 'line',
      id: node.id,
      speaker: node.speaker ?? '',
      text: node.text ?? node.description ?? '',
      male: node.variants?.male ?? '',
      female: node.variants?.female ?? '',
    };
  }
  private choice(node: ChoiceNode): EditableNode {
    return {
      type: 'choice',
      id: node.id,
      prompt: node.prompt ?? '',
      options: node.options.map((option) => ({
        id: option.id,
        label: option.label,
        nodes: this.toEditable(option.nodes),
      })),
    };
  }
}
