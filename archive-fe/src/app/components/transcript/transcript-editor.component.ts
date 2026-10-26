import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnChanges,
  Optional,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { QuillModule } from 'ngx-quill';
import { ButtonModule } from 'primeng/button';
import { MediaPickerComponent } from '../media-picker/media-picker.component';
import { InputTextModule } from 'primeng/inputtext';
import { ImageModule } from 'primeng/image';
import { DialogueNode, ImageNode, LineNode } from '../../models/transcript.models';
import { LanguageService } from '../../services/language.service';
import {
  ArchiveStorageService,
  isRenderableImageSource,
} from '../../services/archive-storage.service';
import { UiTextPipe } from '../../i18n/ui-text.pipe';

type EditableNode = EditableLine | EditableImage;
interface EditableLine {
  type: 'line';
  id: string;
  speaker: string;
  sprite: string;
  text: string;
  male: string;
  female: string;
  options: EditableOption[];
}
interface EditableOption {
  id: string;
  label: string;
  nodes: EditableNode[];
}
interface EditableImage {
  type: 'image';
  id: string;
  src: string;
  male: string;
  female: string;
}

@Component({
  selector: 'app-transcript-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    QuillModule,
    ButtonModule,
    InputTextModule,
    ImageModule,
    MediaPickerComponent,
    UiTextPipe,
  ],
  templateUrl: './transcript-editor.component.html',
  host: {
    class: 'block w-full min-w-0 max-w-full',
  },
  styleUrl: './transcript-editor.component.css',
})
export class TranscriptEditorComponent implements OnChanges {
  @Input() nodes: EditableNode[] = [];

  @Input() collapseAll = false;

  @Input() showCollapseControls = true;

  @Input() assetOwnerId = '';

  @Output() changed = new EventEmitter<void>();

  public pickerVisible = false;

  public pickerValue = '';

  public pickerTarget: 'sprite' | 'image' | 'image-male' | 'image-female' = 'image';

  public readonly imagePickerTargets = [
    { key: 'image' as const, label: 'defaultImage' },
    { key: 'image-male' as const, label: 'maleImage' },
    { key: 'image-female' as const, label: 'femaleImage' },
  ];

  public pickerNode: EditableLine | EditableImage | null = null;

  constructor(
    @Optional() @Inject(DomSanitizer) private readonly sanitizer?: DomSanitizer,
    @Optional() @Inject(LanguageService) private readonly language?: LanguageService,
    @Optional() @Inject(ArchiveStorageService) private readonly storage?: ArchiveStorageService,
  ) {}

  readonly modules = { toolbar: [['bold', 'italic'], [{ color: [] }], ['clean']] };

  private draggedIndex: number | null = null;

  public collapsedAll = false;

  public isDragging = false;

  public openInsertIndex: number | null = null;

  private readonly collapsedNodes = new Set<string>();

  public ngOnChanges(changes: SimpleChanges) {
    if (changes['collapseAll']) {
      this.collapsedAll = changes['collapseAll'].currentValue;
    }
  }

  public setAllCollapsed(collapsed: boolean) {
    this.collapsedAll = collapsed;
    this.collapsedNodes.clear();
  }

  public isCollapsed(node: EditableNode) {
    return this.collapsedAll || this.collapsedNodes.has(node.id);
  }

  public toggleCollapsed(node: EditableNode) {
    if (this.collapsedAll) {
      this.setAllCollapsed(false);
      return;
    }
    if (this.collapsedNodes.has(node.id)) {
      this.collapsedNodes.delete(node.id);
    } else {
      this.collapsedNodes.add(node.id);
    }
  }

  public lineSummary(node: EditableLine) {
    return node.speaker ? node.speaker + ':' : (this.language?.text('narration') ?? 'Narration:');
  }

  public imagePreviewUrl(value?: string): string {
    return value ? (this.storage?.toPublicUrl(value) ?? value) : '';
  }

  public openMediaPicker(
    target: 'sprite' | 'image' | 'image-male' | 'image-female',
    node: EditableLine | EditableImage,
  ) {
    this.pickerTarget = target;
    this.pickerNode = node;
    this.pickerValue =
      target === 'sprite' && node.type === 'line'
        ? node.sprite
        : node.type === 'image'
          ? target === 'image-male'
            ? node.male
            : target === 'image-female'
              ? node.female
              : node.src
          : '';
    this.pickerVisible = true;
  }

  public mediaPicked(value: string) {
    if (this.pickerTarget === 'sprite' && this.pickerNode?.type === 'line') {
      this.pickerNode.sprite = value;
    } else if (this.pickerNode?.type === 'image') {
      if (this.pickerTarget === 'image-male') {
        this.pickerNode.male = value;
      } else if (this.pickerTarget === 'image-female') {
        this.pickerNode.female = value;
      } else {
        this.pickerNode.src = value;
      }
    }
    this.changed.emit();
  }

  public summaryHtml(value?: string) {
    const decoded = (value || '')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, '&')
      .replace(/color\s*:\s*rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)/gi, 'color:#000000')
      .replace(/color\s*:\s*rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)/gi, 'color:#FFFFFF');
    const cleaned = decoded
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+style\s*=\s*(["'])(.*?)\1/gi, (_match, quote, styles) => {
        const safeStyles = styles
          .split(';')
          .map((style: string) => style.trim())
          .filter(
            (style: string) =>
              /^(color\s*:\s*(#[0-9a-f]{3,8}|[a-z]+|rgba?\([^)]*\))|font-weight\s*:\s*(normal|bold|[1-9]00)|font-style\s*:\s*(normal|italic))$/i.test(
                style,
              ) &&
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
    return this.sanitizer?.bypassSecurityTrustHtml(cleaned) ?? cleaned;
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

  public toggleInsert(index: number) {
    this.openInsertIndex = this.openInsertIndex === index ? null : index;
  }

  @HostListener('document:pointerdown', ['$event'])
  public closeInsertOnOutside(event: PointerEvent) {
    if (!(event.target as Element | null)?.closest('.insertion-gap')) {
      this.openInsertIndex = null;
    }
  }

  public insertLine(index: number, event?: MouseEvent) {
    this.insert(index, {
      type: 'line',
      id: crypto.randomUUID(),
      speaker: '',
      sprite: '',
      text: '',
      male: '',
      female: '',
      options: [],
    });
    (event?.currentTarget as HTMLElement | null)?.blur();
  }

  public insertImage(index: number, event?: MouseEvent) {
    this.insert(index, {
      type: 'image',
      id: crypto.randomUUID(),
      src: '',
      male: '',
      female: '',
    });
    (event?.currentTarget as HTMLElement | null)?.blur();
  }

  private insert(index: number, node: EditableNode) {
    this.nodes.splice(index, 0, node);
    this.openInsertIndex = null;
    this.changed.emit();
  }

  remove(index: number) {
    this.nodes.splice(index, 1);
    this.changed.emit();
  }
  dragStart(index: number, event: DragEvent) {
    this.draggedIndex = index;
    this.isDragging = true;
    this.openInsertIndex = null;
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }
  dragEnd() {
    this.draggedIndex = null;
    this.isDragging = false;
  }
  drop(index: number, event: DragEvent) {
    if (!this.isDragging || this.draggedIndex === null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const source = this.draggedIndex;
    if (
      !Number.isInteger(source) ||
      source < 0 ||
      source >= this.nodes.length ||
      source === index
    ) {
      this.dragEnd();
      return;
    }
    const [node] = this.nodes.splice(source, 1);
    this.nodes.splice(source < index ? index - 1 : index, 0, node);
    this.dragEnd();
    this.changed.emit();
  }
  allowDrop(event: DragEvent) {
    if (!this.isDragging) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }
  addOption(line: EditableLine) {
    line.options.push(this.newOption());
  }
  removeOption(line: EditableLine, index: number) {
    if (line.options.length > 1) line.options.splice(index, 1);
  }
  newOption(): EditableOption {
    return { id: crypto.randomUUID(), label: '', nodes: [] };
  }
  serialize(): DialogueNode[] {
    return this.serializeNodes(this.nodes);
  }
  private serializeNodes(nodes: EditableNode[]): DialogueNode[] {
    return nodes.map((node) => (node.type === 'line' ? this.line(node) : this.image(node)));
  }

  private image(image: EditableImage): ImageNode {
    const variants =
      image.male || image.female
        ? { male: image.male || undefined, female: image.female || undefined }
        : undefined;
    return {
      type: 'image',
      id: image.id,
      src: image.src || image.male || image.female,
      ...(variants ? { variants } : {}),
    };
  }
  private line(line: EditableLine): LineNode {
    const result: LineNode = {
      type: 'line',
      id: line.id,
      speaker: line.speaker,
      sprite: line.sprite || undefined,
      text: line.text,
    };
    if (line.male || line.female)
      result.variants = { male: line.male || line.text, female: line.female || line.text };
    if (line.options.length) {
      result.options = line.options.map((option) => ({
        id: option.id,
        label: option.label,
        nodes: this.serializeNodes(option.nodes),
      }));
    }
    return result;
  }
}
export type { EditableNode };
