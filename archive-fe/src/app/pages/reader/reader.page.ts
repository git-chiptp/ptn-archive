import { CommonModule } from '@angular/common';
import { effect } from '@angular/core';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ChoiceNode,
  DialogueNode,
  Gender,
  LineNode,
  Transcript,
} from '../../models/transcript.models';
import {
  NodeEditorComponent,
  EditableNode,
} from '../../components/transcript/node-editor.component';
import { NodeListComponent } from '../../components/transcript/node-list.component';
import { ArchiveStore } from '../../services/archive.store';
import { LanguageCode, LanguageService } from '../../services/language.service';
import { TranscriptImportService } from '../../services/transcript-import.service';
import { finalize } from 'rxjs/operators';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NodeListComponent, NodeEditorComponent],
  templateUrl: './reader.page.html',
})
export class ReaderPage {
  private route = inject(ActivatedRoute);

  private router = inject(Router);

  private importer = inject(TranscriptImportService);

  private cdr = inject(ChangeDetectorRef);

  public readonly store = inject(ArchiveStore);

  public readonly language = inject(LanguageService);

  public selections: Record<string, string> = {};

  public transcript: Transcript | undefined;

  public readonly editMode = this.route.snapshot.queryParamMap.get('edit') === '1';

  public editLanguage: LanguageCode = 'en';

  public pendingEditLanguage: LanguageCode | null = null;

  public showLanguagePrompt = false;

  public editParent = '';

  public editStage = '';

  public editNodes: EditableNode[] = [];

  public importMessage = '';

  public importLoading = false;

  public pendingImportNodes: EditableNode[] = [];

  public pendingImportName = '';

  public pendingImportReady = false;

  public importError = false;

  private activeEditLanguage: LanguageCode = 'en';

  private editSnapshot = '';

  private editDirty = false;

  public get backLink(): string[] {
    if (!this.transcript) {
      return ['/'];
    }
    if (this.transcript.category === 'perspectra' && this.route.snapshot.paramMap.get('partId')) {
      return [
        '/perspectra',
        this.route.snapshot.paramMap.get('characterId') ?? '',
        this.route.snapshot.paramMap.get('chapterId') ?? '',
      ];
    }
    const collection = this.store
      .collections(this.transcript.category)
      .find((item) => item.stages.some((stage) => stage.id === this.transcript?.id));
    return collection
      ? ['/', this.transcript.category, collection.id]
      : ['/', this.transcript.category];
  }

  public get localizedTranscript(): Transcript | undefined {
    if (!this.transcript) {
      return undefined;
    }
    const translation = this.transcript.translations?.[this.language.current()];
    return translation
      ? { ...this.transcript, ...translation, nodes: translation.nodes ?? this.transcript.nodes }
      : this.transcript;
  }
  constructor() {
    effect(() => {
      const id =
        this.route.snapshot.paramMap.get('stageId') ?? this.route.snapshot.paramMap.get('partId');
      const next = this.store.transcripts().find((item) => item.id === id);
      if (next && next.id !== this.transcript?.id) {
        this.store.loadTranslations(next.id);
        this.transcript = next;
        this.editLanguage = next.sourceLanguage ?? 'en';
        this.applyEditLanguage(next);
      }
    });
  }
  public editLanguageChanged(next: LanguageCode) {
    if (!this.transcript || next === this.activeEditLanguage) {
      return;
    }
    if (this.isEditDirty) {
      this.pendingEditLanguage = next;
      this.editLanguage = this.activeEditLanguage;
      this.showLanguagePrompt = true;
      return;
    }
    this.switchEditLanguage(next);
  }
  public markEditDirty() {
    this.editDirty = true;
  }
  public get isEditDirty() {
    return (
      this.editDirty ||
      this.editSnapshot !==
        JSON.stringify({ parent: this.editParent, stage: this.editStage, nodes: this.editNodes })
    );
  }
  public savePendingLanguageChange() {
    const next = this.pendingEditLanguage;
    this.showLanguagePrompt = false;
    this.pendingEditLanguage = null;
    this.save();
    if (next) {
      this.switchEditLanguage(next);
    }
  }
  public discardPendingLanguageChange() {
    const next = this.pendingEditLanguage;
    this.showLanguagePrompt = false;
    this.pendingEditLanguage = null;
    if (next) {
      this.switchEditLanguage(next);
    }
  }
  public cancelPendingLanguageChange() {
    this.showLanguagePrompt = false;
    this.pendingEditLanguage = null;
    this.editLanguage = this.activeEditLanguage;
  }
  private switchEditLanguage(next: LanguageCode) {
    this.editLanguage = next;
    this.activeEditLanguage = next;
    if (!this.transcript) {
      return;
    }
    this.store.loadTranslations(this.transcript.id, () => {
      const refreshed = this.store.transcripts().find((item) => item.id === this.transcript?.id);
      if (refreshed) {
        this.transcript = refreshed;
        this.applyEditLanguage(refreshed);
      }
    });
  }
  private applyEditLanguage(transcript: Transcript) {
    const selected = this.editLanguage;
    const translation = transcript.translations?.[selected];
    if (selected === (transcript.sourceLanguage ?? 'en') || !translation) {
      this.editParent = transcript.parentLabel;
      this.editStage = transcript.stageLabel;
      this.editNodes = this.toEditable(transcript.nodes);
      this.captureEditSnapshot();
      return;
    }
    this.editParent = translation.parentLabel ?? transcript.parentLabel;
    this.editStage = translation.stageLabel ?? transcript.stageLabel;
    this.editNodes = this.toEditable(translation.nodes ?? transcript.nodes);
    this.captureEditSnapshot();
  }
  private captureEditSnapshot() {
    this.editSnapshot = JSON.stringify({
      parent: this.editParent,
      stage: this.editStage,
      nodes: this.editNodes,
    });
    this.editDirty = false;
  }
  public setGender(gender: Gender) {
    this.store.setGender(gender);
  }
  public select(event: { id: string; option: string }) {
    this.selections = { ...this.selections, [event.id]: event.option };
  }
  public importFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.pendingImportNodes = [];
    this.pendingImportName = '';
    this.pendingImportReady = false;
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
  public importPending() {
    if (!this.pendingImportReady || !this.pendingImportNodes.length) {
      return;
    }
    if (
      this.isEditDirty &&
      !confirm('Importing this file will replace the current transcript edits. Continue?')
    ) {
      return;
    }
    this.editNodes = this.pendingImportNodes;
    this.pendingImportNodes = [];
    this.pendingImportName = '';
    this.pendingImportReady = false;
    this.editDirty = true;
    this.importMessage = 'Imported transcript lines into the editor.';
  }
  public save() {
    if (!this.transcript || !this.editNodes.length) {
      return;
    }
    const helper = new NodeEditorComponent();
    helper.nodes = this.editNodes;
    const updated: Transcript = {
      ...this.transcript,
      title: this.transcript.title,
      parentLabel: this.editParent,
      stageLabel: this.editStage,
      parentId: this.editParent.toLowerCase().replaceAll(' ', '-'),
      nodes: helper.serialize(),
    };
    if (this.editLanguage === (this.transcript.sourceLanguage ?? 'en')) {
      this.store.update(updated);
      this.transcript = updated;
    } else {
      this.store.saveTranslation(this.transcript.id, this.editLanguage, {
        title: updated.title,
        parentLabel: updated.parentLabel,
        stageLabel: updated.stageLabel,
        description: updated.description,
        nodes: updated.nodes,
      });
    }
    this.captureEditSnapshot();
  }
  public remove() {
    if (
      this.transcript &&
      confirm(`Delete "${this.transcript.parentLabel} / ${this.transcript.stageLabel}"?`)
    ) {
      const destination = this.backLink;
      this.store.remove(this.transcript.id);
      this.router.navigate(destination);
    }
  }
  private toEditable(nodes: DialogueNode[]): EditableNode[] {
    return nodes.map((node) =>
      node.type === 'line'
        ? {
            type: 'line',
            id: node.id,
            speaker: node.speaker ?? '',
            text: node.text ?? node.description ?? '',
            male: node.variants?.male ?? '',
            female: node.variants?.female ?? '',
          }
        : this.choice(node),
    );
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
