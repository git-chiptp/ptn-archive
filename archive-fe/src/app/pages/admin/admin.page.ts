import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
import { ImportedLine, TranscriptImportService } from '../../services/transcript-import.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NodeEditorComponent],
  templateUrl: './admin.page.html',
})
export class AdminPage {
  private store = inject(ArchiveStore);
  private importer = inject(TranscriptImportService);
  published = false;
  importMessage = '';
  editingId: string | null = null;
  form = { category: 'main-story' as Category, title: '', parentLabel: '', stageLabel: '' };
  nodes: EditableNode[] = [this.newLine()];
  get transcripts() {
    return this.store.transcripts();
  }
  newLine(): EditableNode {
    return { type: 'line', id: crypto.randomUUID(), speaker: '', text: '', male: '', female: '' };
  }
  edit(transcript: Transcript) {
    this.editingId = transcript.id;
    this.form = {
      category: transcript.category,
      title: transcript.title,
      parentLabel: transcript.parentLabel,
      stageLabel: transcript.stageLabel,
    };
    this.nodes = this.toEditable(transcript.nodes);
    this.published = false;
  }
  cancelEdit() {
    this.editingId = null;
    this.form = { category: 'main-story', title: '', parentLabel: '', stageLabel: '' };
    this.nodes = [this.newLine()];
  }
  delete(transcript: Transcript) {
    if (confirm(`Delete "${transcript.title}"?`)) {
      this.store.remove(transcript.id);
      if (this.editingId === transcript.id) this.cancelEdit();
    }
  }
  importFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!/\.(csv|tsv)$/i.test(file.name)) {
      this.importMessage = 'Export the Excel sheet as CSV or TSV before importing.';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const imported: ImportedLine[] = this.importer.parseDelimited(String(reader.result));
      this.nodes = imported.map((line) => ({
        type: 'line',
        id: crypto.randomUUID(),
        speaker: line.speaker,
        text: line.text || line.description,
        male: '',
        female: '',
      }));
      this.importMessage = `${this.nodes.length} lines imported.`;
    };
    reader.readAsText(file);
  }
  submit(formRef: NgForm) {
    if (formRef.invalid || !this.nodes.length) return;
    const helper = new NodeEditorComponent();
    helper.nodes = this.nodes;
    const current: Transcript = {
      id: this.editingId ?? crypto.randomUUID(),
      title: this.form.title,
      category: this.form.category,
      parentId: this.form.parentLabel.toLowerCase().replaceAll(' ', '-'),
      parentLabel: this.form.parentLabel,
      stageLabel: this.form.stageLabel,
      description: '',
      nodes: helper.serialize(),
    };
    if (this.editingId) this.store.update(current);
    else this.store.add(current);
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
