import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ButtonModule } from 'primeng/button';
import { ImageModule } from 'primeng/image';
import { DialogueNode, Gender, ImageNode, LineNode } from '../../models/transcript.models';
import { isRenderableImageSource } from '../../services/archive-storage.service';
@Component({
  selector: 'app-node-list',
  standalone: true,
  imports: [CommonModule, ButtonModule, ImageModule],
  templateUrl: './node-list.component.html',
  host: {
    class: 'block w-full min-w-0 max-w-full',
  },
})
export class NodeListComponent {
  private sanitizer = inject(DomSanitizer);
  @Input() nodes: DialogueNode[] = [];
  @Input() gender: Gender = 'female';
  @Input() chiefName = 'A';
  @Input() selections: Record<string, string> = {};
  @Output() changed = new EventEmitter<{ id: string; option: string }>();
  html(node: LineNode) {
    const value = node.variants ? node.variants[this.gender] : node.text || node.description || '';
    return this.richText(value);
  }

  htmlText(value?: string) {
    return this.richText(value || '');
  }

  public displayText(value?: string) {
    return this.replaceChiefName(value || '');
  }

  public image(node: ImageNode) {
    return node.src;
  }

  private richText(value: string) {
    const decoded = value
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#123;/gi, '{')
      .replace(/&#125;/gi, '}')
      .replace(/&amp;/gi, '&')
      .replace(/color\s*:\s*rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)/gi, 'color:#000000')
      .replace(/color\s*:\s*rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)/gi, 'color:#FFFFFF');
    const cleaned = this.replaceChiefName(decoded)
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+style\s*=\s*(["'])(.*?)\1/gi, (_match, quote, styles) => {
        const safeStyles = styles
          .split(';')
          .map((style: string) => style.trim())
          .filter((style: string) =>
            /^(color\s*:\s*(#[0-9a-f]{3,8}|[a-z]+|rgba?\([^)]*\))|font-weight\s*:\s*(normal|bold|[1-9]00)|font-style\s*:\s*(normal|italic))$/i.test(style) &&
            (!/^color\s*:/i.test(style) || !this.isThemeNeutralColor(style)),
          )
          .join(';');
        return safeStyles ? ` style=${quote}${safeStyles}${quote}` : '';
      })
      .replace(/<img\b([^>]*)>/gi, (_match, attributes) => {
        const source = attributes.match(/\s+src=["']([^"']+)["']/i)?.[1] || '';
        return isRenderableImageSource(source)
          ? `<img src="${source.replace(/"/g, '&quot;')}" alt="">`
          : '';
      })
      .replace(/<(?!\/?(span|strong|em|b|i|br|img)\b)[^>]*>/gi, '');
    return this.sanitizer.bypassSecurityTrustHtml(cleaned);
  }

  private isThemeNeutralColor(style: string) {
    const color = style
      .replace(/^color\s*:/i, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    return (
      color === 'black' ||
      color === 'white' ||
      /^#(?:0{3}|0{6}|0{8}|f{3}|f{6}|f{8})$/i.test(color) ||
      /^rgba?\((?:0,0,0|255,255,255)(?:,[\d.]+)?\)$/i.test(color)
    );
  }

  private replaceChiefName(value: string) {
    return value.replace(/\{\{\s*name\s*\}\}/gi, this.chiefName.trim() || 'A');
  }
}
