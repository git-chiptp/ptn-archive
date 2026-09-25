import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { ChoiceNode, DialogueNode, LineNode } from '../../models/transcript.models';

type EditableNode = EditableLine | EditableChoice;
interface EditableLine {
  type: 'line';
  id: string;
  speaker: string;
  text: string;
  male: string;
  female: string;
}
interface EditableChoice {
  type: 'choice';
  id: string;
  prompt: string;
  options: { id: string; label: string; nodes: EditableNode[] }[];
}

@Component({
  selector: 'app-node-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, QuillModule],
  templateUrl: './node-editor.component.html',
})
export class NodeEditorComponent {
  @Input() nodes: EditableNode[] = [];
  readonly modules = { toolbar: [['bold', 'italic'], [{ color: [] }], ['clean']] };
  addLine() {
    this.nodes.push({
      type: 'line',
      id: crypto.randomUUID(),
      speaker: '',
      text: '',
      male: '',
      female: '',
    });
  }
  addChoice() {
    this.nodes.push({
      type: 'choice',
      id: crypto.randomUUID(),
      prompt: '',
      options: [this.newOption()],
    });
  }
  remove(index: number) {
    this.nodes.splice(index, 1);
  }
  addOption(choice: EditableChoice) {
    choice.options.push(this.newOption());
  }
  removeOption(choice: EditableChoice, index: number) {
    if (choice.options.length > 1) choice.options.splice(index, 1);
  }
  newOption() {
    return { id: crypto.randomUUID(), label: '', nodes: [] as EditableNode[] };
  }
  serialize(): DialogueNode[] {
    return this.serializeNodes(this.nodes);
  }
  private serializeNodes(nodes: EditableNode[]): DialogueNode[] {
    return nodes.map((node) =>
      node.type === 'line'
        ? this.line(node)
        : {
            type: 'choice',
            id: node.id,
            prompt: node.prompt,
            options: node.options.map((option) => ({
              id: option.id,
              label: option.label,
              nodes: this.serializeNodes(option.nodes),
            })),
          },
    );
  }
  private line(line: EditableLine): LineNode {
    const result: LineNode = { type: 'line', id: line.id, speaker: line.speaker, text: line.text };
    if (line.male || line.female)
      result.variants = { male: line.male || line.text, female: line.female || line.text };
    return result;
  }
}
export type { EditableNode };
