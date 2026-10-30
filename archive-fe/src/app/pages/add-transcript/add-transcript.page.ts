import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { finalize } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { ImageModule } from 'primeng/image';
import {
  Category,
  DialogueNode,
  Gender,
  LineNode,
  ImageNode,
  Transcript,
} from '../../models/transcript.models';
import {
  TranscriptEditorComponent,
  EditableNode,
} from '../../components/transcript/transcript-editor.component';
import { NodeListComponent } from '../../components/transcript/node-list.component';
import { ArchiveStore } from '../../services/archive.store';
import { LanguageCode, LanguageService } from '../../services/language.service';
import { ArchiveStorageService } from '../../services/archive-storage.service';
import {
  ImportLanguageOption,
  ImportedTranscriptMetadata,
  TranscriptImportService,
} from '../../services/transcript-import.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    BreadcrumbModule,
    ConfirmDialogModule,
    DialogModule,
    FileUploadModule,
    InputTextModule,
    TextareaModule,
    MessageModule,
    ProgressBarModule,
    SelectButtonModule,
    SelectModule,
    ImageModule,
    TranscriptEditorComponent,
    NodeListComponent,
  ],
  templateUrl: './add-transcript.page.html',
})
export class AddTranscriptPage {
  private store = inject(ArchiveStore);

  private cdr = inject(ChangeDetectorRef);

  private importer = inject(TranscriptImportService);

  private readonly storage = inject(ArchiveStorageService);

  private route = inject(ActivatedRoute);

  private initialSnapshot = '';

  private router = inject(Router);

  private readonly confirmation = inject(ConfirmationService);

  readonly languages = inject(LanguageService);

  public readonly categoryOptions: { label: string; value: Category }[] = [
    { label: 'Main story', value: 'main-story' },
    { label: 'Eternal Nightmare', value: 'eternal-nightmare' },
    { label: 'Event story', value: 'event-story' },
    { label: 'Interrogation', value: 'interrogation' },
    { label: 'Mirage', value: 'mirage' },
    { label: 'Perspectra', value: 'perspectra' },
  ];

  public readonly breadcrumbHome: MenuItem = {
    icon: 'pi pi-home',
    command: () => this.requestBreadcrumbNavigation(['/']),
  };

  public published = false;

  public importMessage = '';

  public editingId: string | null = null;

  public readonly draftAssetOwnerId = crypto.randomUUID();

  public get assetOwnerId() {
    return `${this.editingId ?? this.draftAssetOwnerId}/${this.form.language}`;
  }

  public form = {
    category: 'main-story' as Category,
    language: 'en' as LanguageCode,
    parentLabel: '',
    stageLabel: '',
    title: '',
    description: '',
  };

  public nodes: EditableNode[] = [this.newLine()];

  public previewNodes: DialogueNode[] = [];

  public previewSelections: Record<string, string> = {};

  public previewGender: Gender = 'female';

  public previewChiefName = 'A';

  public previewOpen = false;

  public readonly protagonistOptions = [
    {
      value: 'female' as Gender,
      label: 'Chief A',
      imageUrl: 'https://pathtonowhere.wiki.gg/images/ChiefF_Icon.png?5ca70b=&format=original',
      alt: 'Protagonist variant A',
    },
    {
      value: 'male' as Gender,
      label: 'Chief B',
      imageUrl: 'https://pathtonowhere.wiki.gg/images/ChiefM_Icon.png?a08214=&format=original',
      alt: 'Protagonist variant B',
    },
  ];

  public pendingImportNodes: EditableNode[] = [];

  private pendingImportMetadata: ImportedTranscriptMetadata = {};

  public importLanguageOptions: ImportLanguageOption[] = [];

  public importLanguage = '';

  private importFileSource: File | null = null;

  public pendingImportName = '';

  public pendingImportReady = false;

  public importApplying = false;

  public importLoading = false;

  public importError = false;

  public importProgress = 0;

  public readonly maxImportFileSize = 100_000_000;

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

    if (
      category === 'eternal-nightmare' ||
      category === 'event-story' ||
      category === 'interrogation' ||
      category === 'mirage' ||
      category === 'perspectra'
    ) {
      this.form.category = category;
    }

    this.captureSnapshot();
  }

  public get transcripts() {
    return this.store.transcripts();
  }

  public get breadcrumbItems(): MenuItem[] {
    const categoryLabel = this.categoryOptions.find(
      (option) => option.value === this.form.category,
    )?.label;
    const parentLabel = this.form.parentLabel.trim();
    const items: MenuItem[] = [
      this.breadcrumbItem(categoryLabel ?? this.form.category, ['/', this.form.category]),
    ];
    if (parentLabel) {
      items.push(
        this.breadcrumbItem(this.localizedParentLabel(parentLabel), [
          '/',
          this.form.category,
          this.slug(parentLabel),
        ]),
      );
    }
    items.push({ label: this.editingId ? 'Edit' : 'Add stage' });
    return items;
  }

  public localizedParentLabel(parentLabel: string): string {
    return (
      this.store.collections(this.form.category).find((item) => item.label === parentLabel)
        ?.localizedLabel ?? parentLabel
    );
  }

  private breadcrumbItem(label: string, link: string[]): MenuItem {
    return {
      label,
      linkClass: 'cursor-pointer',
      command: () => this.requestBreadcrumbNavigation(link),
    };
  }

  private requestBreadcrumbNavigation(link: string[]) {
    if (!this.isDirty) {
      this.router.navigate(link);
      return;
    }
    this.confirmation.confirm({
      key: 'transcript-actions',
      header: 'Leave editor?',
      message: 'Changes will not be saved. Do you want to exit?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Exit',
      rejectLabel: 'Keep editing',
      accept: () => this.router.navigate(link),
    });
  }

  private get isDirty() {
    return this.initialSnapshot !== this.snapshot();
  }

  private snapshot() {
    return JSON.stringify({ form: this.form, nodes: this.nodes });
  }

  private captureSnapshot() {
    this.initialSnapshot = this.snapshot();
  }

  public slug(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  public get parentChoices() {
    const category = this.form.category;
    const choices = this.store
      .collections(category)
      .map((item) => ({ id: item.id, name: item.localizedLabel, value: item.label }));
    if (this.form.parentLabel && !choices.some((item) => item.value === this.form.parentLabel)) {
      choices.unshift({ id: '', name: this.form.parentLabel, value: this.form.parentLabel });
    }
    return choices;
  }

  private newLine(): EditableNode {
    return {
      type: 'line',
      id: crypto.randomUUID(),
      speaker: '',
      sprite: '',
      text: '',
      male: '',
      female: '',
      options: [],
    };
  }

  public edit(transcript: Transcript) {
    this.editingId = transcript.id;
    this.form = {
      category: transcript.category,
      language: transcript.sourceLanguage ?? 'en',
      parentLabel: transcript.parentLabel,
      stageLabel: transcript.stageLabel,
      title: transcript.title,
      description: transcript.description,
    };
    this.nodes = this.toEditable(transcript.nodes);
    this.published = false;
    this.captureSnapshot();
  }

  public cancelEdit() {
    this.editingId = null;
    this.form = {
      category: 'main-story',
      language: 'en',
      parentLabel: '',
      stageLabel: '',
      title: '',
      description: '',
    };
    this.nodes = [this.newLine()];
    this.captureSnapshot();
  }

  public delete(transcript: Transcript) {
    this.confirmation.confirm({
      key: 'transcript-actions',
      header: 'Delete transcript?',
      message: `Delete "${transcript.parentLabel} / ${transcript.stageLabel}"?`,
      icon: 'pi pi-trash',
      acceptLabel: 'Delete transcript',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.store.remove(transcript.id);
        if (this.editingId === transcript.id) {
          this.cancelEdit();
        }
      },
    });
  }

  public importFile(input: File[] | FileList | Event) {
    const file = Array.isArray(input)
      ? input[0]
      : 'target' in input
        ? (input.target as HTMLInputElement | null)?.files?.[0]
        : input.item(0);
    if (!file) {
      return;
    }
    this.pendingImportNodes = [];
    this.pendingImportMetadata = {};
    this.importLanguageOptions = [];
    this.importLanguage = '';
    this.importFileSource = file;
    this.pendingImportName = '';
    this.pendingImportReady = false;
    this.importApplying = false;
    this.importError = false;
    this.importProgress = 0;
    if (!/\.xlsx$/i.test(file.name)) {
      this.importError = true;
      this.importMessage = 'Import failed: choose an XLSX file exported from Excel.';
      return;
    }
    if (!file.size) {
      this.importError = true;
      this.importMessage = 'Import failed: the XLSX file is empty.';
      return;
    }
    if (file.size > this.maxImportFileSize) {
      this.importError = true;
      this.importMessage = 'Import failed: the XLSX file must be 100 MB or smaller.';
      return;
    }
    this.parseImportFile(file);
  }

  public changeImportLanguage(language: string) {
    if (!this.importFileSource || language === this.importLanguage) {
      return;
    }
    this.importLanguage = language;
    this.parseImportFile(this.importFileSource);
  }

  private parseImportFile(file: File) {
    this.importLoading = true;
    this.importError = false;
    this.importProgress = 5;
    this.importMessage = 'Reading XLSX file in the browser...';
    this.importer
      .parseXlsx(file, this.importLanguage || undefined, (progress) => {
        this.importProgress = progress;
        this.cdr.markForCheck();
      })
      .pipe(
        finalize(() => {
          this.importLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (result) => {
          this.importProgress = 100;
          this.importLanguageOptions = result.languages;
          this.importLanguage = result.selectedLanguage;
          this.pendingImportMetadata = result.metadata;
          this.pendingImportNodes = this.toEditable(this.importer.toNodes(result.lines));
          this.pendingImportName = file.name;
          this.pendingImportReady = this.pendingImportNodes.length > 0;
          this.importError = this.pendingImportNodes.length === 0;
          this.importMessage = this.pendingImportNodes.length
            ? this.pendingImportNodes.length + ' lines ready to import.'
            : 'Import failed: no transcript rows found.';
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.importProgress = 0;
          this.pendingImportNodes = [];
          this.pendingImportName = '';
          this.pendingImportReady = false;
          this.importError = true;
          this.importMessage =
            error instanceof Error
              ? error.message
              : 'Import failed: the browser could not parse the XLSX file.';
          this.cdr.markForCheck();
        },
      });
  }
  importPending() {
    if (!this.pendingImportReady || !this.pendingImportNodes.length) {
      return;
    }
    if (this.editorHasContent()) {
      this.confirmation.confirm({
        key: 'transcript-actions',
        header: 'Replace transcript content?',
        message:
          'Importing this file will replace all current transcript content. Continue?',
        icon: 'pi pi-upload',
        acceptLabel: 'Import file',
        rejectLabel: 'Cancel',
        accept: () => this.applyPendingImport(),
      });
      return;
    }
    this.applyPendingImport();
  }

  private async applyPendingImport() {
    if (this.importApplying) {
      return;
    }
    this.importApplying = true;
    this.importError = false;
    this.importMessage = this.languages.text('resolvingImportImages');
    try {
      const helper = new TranscriptEditorComponent();
      helper.nodes = this.pendingImportNodes;
      const result = await this.storage.importRemoteMediaReferences(helper.serialize());
      this.form = {
        ...this.form,
        title: this.pendingImportMetadata.name ?? this.form.title,
        stageLabel: this.pendingImportMetadata.stage ?? this.form.stageLabel,
        description: this.pendingImportMetadata.description ?? this.form.description,
      };
      this.nodes = this.toEditable(result.nodes);
      this.pendingImportNodes = [];
      this.pendingImportMetadata = {};
      this.pendingImportReady = false;
      this.pendingImportName = '';
      this.importError = result.unresolved > 0;
      this.importMessage =
        result.unresolved > 0
          ? this.languages.text('importedWithUnresolvedImages', {
              count: String(result.unresolved),
            })
          : this.languages.text('importedLines', { count: String(this.nodes.length) });
    } catch (error: unknown) {
      this.importError = true;
      this.importMessage =
        error instanceof Error
          ? error.message
          : 'Import failed: the image references could not be resolved.';
    } finally {
      this.importApplying = false;
      this.cdr.markForCheck();
    }
  }
  private editorHasContent() {
    const hasContent = (nodes: EditableNode[]): boolean =>
      nodes.some((node) =>
        node.type === 'line'
          ? !!(
              node.speaker ||
              node.text ||
              node.male ||
              node.female ||
              node.options.some((option) => option.label || hasContent(option.nodes))
            )
          : !!(node.src || node.male || node.female),
      );
    return hasContent(this.nodes);
  }

  public selectPreview(event: { id: string; option: string }) {
    this.previewSelections = { ...this.previewSelections, [event.id]: event.option };
  }

  public async openPreview() {
    if (!this.nodes.length) {
      return;
    }
    const editor = new TranscriptEditorComponent();
    editor.nodes = this.nodes;
    const nodes = editor.serialize();
    await this.storage.resolveMediaReferences(this.storage.mediaReferences(nodes)).catch(() => undefined);
    this.previewNodes = this.storage.toPublicNodes(nodes);
    this.previewSelections = {};
    this.previewGender = 'female';
    this.previewOpen = true;
  }

  public submit(formRef: NgForm) {
    if (formRef.invalid || !this.nodes.length) {
      return;
    }
    this.confirmation.confirm({
      key: 'transcript-actions',
      header: this.editingId ? 'Save transcript?' : 'Publish transcript?',
      message: this.editingId
        ? 'Save this transcript and publish the changes?'
        : 'Publish this transcript?',
      icon: 'pi pi-save',
      acceptLabel: this.editingId ? 'Save transcript' : 'Publish transcript',
      rejectLabel: 'Cancel',
      accept: () => this.persistTranscript(),
    });
  }

  private persistTranscript() {
    const helper = new TranscriptEditorComponent();
    helper.nodes = this.nodes;
    const current: Transcript = {
      id: this.editingId ?? this.draftAssetOwnerId,
      title: this.form.title.trim() || this.form.stageLabel,
      category: this.form.category,
      parentId:
        this.parentChoices.find((item) => item.value === this.form.parentLabel)?.id ??
        this.slug(this.form.parentLabel),
      parentLabel: this.form.parentLabel,
      stageLabel: this.form.stageLabel,
      description: this.form.description,
      nodes: helper.serialize(),
      sourceLanguage: this.form.language,
    };
    if (
      this.editingId &&
      this.form.language !==
        (this.transcripts.find((item) => item.id === this.editingId)?.sourceLanguage ?? 'en')
    ) {
      this.store.saveTranslation(
        this.editingId,
        this.form.language,
        {
          title: current.title,
          description: current.description,
          parentLabel: current.parentLabel,
          stageLabel: current.stageLabel,
          nodes: current.nodes,
        },
        () => this.redirectToStageSelector(current),
      );
    } else if (this.editingId) {
      this.store.update(current, () => this.redirectToStageSelector(current));
    } else {
      this.store.add(current, (created) => this.redirectToStageSelector(created));
    }
  }
  private redirectToStageSelector(transcript: Transcript) {
    this.published = true;
    this.router.navigate(['/', transcript.category, this.slug(transcript.parentLabel)]);
  }

  private toEditable(nodes: DialogueNode[]): EditableNode[] {
    return nodes.map((node) => (node.type === 'line' ? this.line(node) : this.image(node)));
  }

  private image(node: ImageNode): EditableNode {
    return {
      type: 'image',
      id: node.id,
      src: node.src,
      male: node.variants?.male ?? '',
      female: node.variants?.female ?? '',
    };
  }
  private line(node: LineNode): EditableNode {
    return {
      type: 'line',
      id: node.id,
      speaker: node.speaker ?? '',
      sprite: node.sprite ?? '',
      text: node.text ?? node.description ?? '',
      male: node.variants?.male ?? '',
      female: node.variants?.female ?? '',
      options: (node.options ?? []).map((option) => ({
        id: option.id,
        label: option.label,
        nodes: this.toEditable(option.nodes),
      })),
    };
  }
}
