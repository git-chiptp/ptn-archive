import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
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
import { LanguageService } from '../../services/language.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NodeListComponent, NodeEditorComponent],
  templateUrl: './reader.page.html',
})
export class ReaderPage {
  readonly store = inject(ArchiveStore);
  readonly language = inject(LanguageService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  selections: Record<string, string> = {};
  transcript = this.store
    .transcripts()
    .find(
      (t) =>
        t.id ===
        (this.route.snapshot.paramMap.get('stageId') ?? this.route.snapshot.paramMap.get('partId')),
    );
  get localizedTranscript(): Transcript | undefined {
    if (!this.transcript) return undefined;
    const translation = this.transcript.translations?.[this.language.current()];
    return translation ? { ...this.transcript, ...translation, nodes: translation.nodes ?? this.transcript.nodes } : this.transcript;
  }
  readonly editMode = this.route.snapshot.queryParamMap.get('edit') === '1';
  editTitle = this.transcript?.title ?? '';
  editParent = this.transcript?.parentLabel ?? '';
  editStage = this.transcript?.stageLabel ?? '';
  editNodes: EditableNode[] = this.transcript ? this.toEditable(this.transcript.nodes) : [];
  setGender(gender: Gender) {
    this.store.setGender(gender);
  }
  select(event: { id: string; option: string }) {
    this.selections = { ...this.selections, [event.id]: event.option };
  }
  save() {
    if (!this.transcript || !this.editNodes.length) return;
    const helper = new NodeEditorComponent();
    helper.nodes = this.editNodes;
    const updated: Transcript = {
      ...this.transcript,
      title: this.editTitle,
      parentLabel: this.editParent,
      stageLabel: this.editStage,
      parentId: this.editParent.toLowerCase().replaceAll(' ', '-'),
      nodes: helper.serialize(),
    };
    this.store.update(updated);
    this.transcript = updated;
  }
  remove() {
    if (this.transcript && confirm(`Delete "${this.transcript.title}"?`)) {
      this.store.remove(this.transcript.id);
      this.router.navigate(['/admin']);
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
