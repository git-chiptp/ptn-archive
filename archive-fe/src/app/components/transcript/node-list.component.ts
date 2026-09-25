import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { SecurityContext } from '@angular/core';
import { DialogueNode, Gender, LineNode } from '../../models/transcript.models';
@Component({
  selector: 'app-node-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './node-list.component.html',
})
export class NodeListComponent {
  private sanitizer = inject(DomSanitizer);
  @Input() nodes: DialogueNode[] = [];
  @Input() gender: Gender = 'female';
  @Input() selections: Record<string, string> = {};
  @Output() changed = new EventEmitter<{ id: string; option: string }>();
  html(node: LineNode) {
    const value = node.variants ? node.variants[this.gender] : node.text || node.description || '';
    return this.sanitizer.sanitize(SecurityContext.HTML, value) || '';
  }
}
