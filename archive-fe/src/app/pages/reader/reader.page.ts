import { CommonModule } from '@angular/common';
import { effect } from '@angular/core';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { InputTextModule } from 'primeng/inputtext';
import { ImageModule } from 'primeng/image';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import {
  ChoiceNode,
  DialogueNode,
  Gender,
  ImageNode,
  LineNode,
  Transcript,
} from '../../models/transcript.models';
import {
  TranscriptEditorComponent,
  EditableNode,
} from '../../components/transcript/transcript-editor.component';
import { NodeListComponent } from '../../components/transcript/node-list.component';
import { ArchiveStore } from '../../services/archive.store';
import { ArchiveStorageService } from '../../services/archive-storage.service';
import { AuthService } from '../../services/auth.service';
import { LanguageCode, LanguageService } from '../../services/language.service';
import { TranscriptImportService } from '../../services/transcript-import.service';
import { finalize } from 'rxjs/operators';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BreadcrumbModule,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    FileUploadModule,
    InputTextModule,
    ImageModule,
    MessageModule,
    ProgressBarModule,
    SelectModule,
    SelectButtonModule,
    NodeListComponent,
    TranscriptEditorComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './reader.page.html',
})
export class ReaderPage {
  private route = inject(ActivatedRoute);

  private readonly routeParams = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  private router = inject(Router);

  private importer = inject(TranscriptImportService);

  private readonly storage = inject(ArchiveStorageService);

  private cdr = inject(ChangeDetectorRef);

  private readonly confirmation = inject(ConfirmationService);

  public readonly store = inject(ArchiveStore);

  public readonly auth = inject(AuthService);

  public readonly breadcrumbHome: MenuItem = {
    icon: 'pi pi-home',
    command: () => this.requestBreadcrumbNavigation(['/']),
  };

  public readonly missingBreadcrumbItems: MenuItem[] = [{ label: 'Transcript not found' }];

  public readonly language = inject(LanguageService);

  public selections: Record<string, string> = {};

  public chiefName = '';

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

  public transcript: Transcript | undefined;

  public editMode = this.route.snapshot.queryParamMap.get('edit') === '1';

  public editLanguage: LanguageCode = 'en';

  public get assetOwnerId() {
    return this.transcript ? `${this.transcript.id}/${this.editLanguage}` : '';
  }

  public pendingEditLanguage: LanguageCode | null = null;

  public showLanguagePrompt = false;

  public editParent = '';

  public editStage = '';

  public editNodes: EditableNode[] = [];

  public previewNodes: DialogueNode[] = [];

  public previewSelections: Record<string, string> = {};

  public previewGender: Gender = 'female';

  public previewOpen = false;

  public saving = false;

  public deleting = false;

  public importMessage = '';

  public importLoading = false;

  public pendingImportNodes: EditableNode[] = [];

  public pendingImportName = '';

  public pendingImportReady = false;

  public importError = false;

  public importProgress = 0;

  public readonly maxImportFileSize = 100_000_000;

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
      ? ['/', this.transcript.category, this.slug(collection.label)]
      : ['/', this.transcript.category];
  }

  private slug(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  public get localizedTranscript(): Transcript | undefined {
    if (!this.transcript || this.store.transcriptUnavailable() === this.transcript.id) {
      return undefined;
    }
    const translation = this.transcript.translations?.[this.language.current()];
    return translation
      ? { ...this.transcript, ...translation, nodes: translation.nodes ?? this.transcript.nodes }
      : this.transcript;
  }

  public get editParentLabel() {
    const category = this.transcript?.category;
    if (category === 'main-story' || category === 'eternal-nightmare') {
      return 'Chapter';
    }
    if (category === 'event-story') {
      return 'Event';
    }
    return 'Character';
  }

  public get editParentOptions(): { label: string; value: string }[] {
    const category = this.transcript?.category;
    if (!category) {
      return [];
    }

    const labels = this.store.collections(category).map((collection) => collection.label);
    const current = this.editParent.trim();
    const uniqueLabels = [...new Set(labels.map((label) => label.trim()).filter(Boolean))];

    if (current && !uniqueLabels.includes(current)) {
      uniqueLabels.unshift(current);
    }

    return uniqueLabels.map((label) => ({ label, value: label }));
  }

  public get breadcrumbItems(): MenuItem[] {
    if (!this.transcript) {
      return [{ label: 'Transcript' }];
    }
    const source = this.transcript;
    const localized = this.localizedTranscript ?? source;
    const categoryLabels: Record<string, string> = {
      'main-story': 'Main story',
      'eternal-nightmare': this.language.text('eternalNightmare'),
      'event-story': 'Event story',
      interrogation: this.language.text('interrogation'),
      mirage: this.language.text('mirage'),
      perspectra: 'Perspectra',
    };
    const categoryLink = ['/', source.category];
    const parentLink = ['/', source.category, this.slug(source.parentLabel)];
    const items: MenuItem[] = [
      this.breadcrumbItem(categoryLabels[source.category] ?? source.category, categoryLink),
      this.breadcrumbItem(localized.parentLabel ?? source.parentLabel, parentLink),
    ];
    if (source.category === 'perspectra' && this.route.snapshot.paramMap.get('partId')) {
      const chapterLabel = source.stageLabel || source.title;
      items.push(
        this.breadcrumbItem(localized.stageLabel ?? chapterLabel, [
          '/perspectra',
          this.slug(source.parentLabel),
          this.slug(chapterLabel),
        ]),
      );
      items.push(this.readerBreadcrumb(localized.title ?? source.title));
      if (this.editMode) {
        items.push({ label: 'Edit' });
      }
      return items;
    }
    items.push(this.readerBreadcrumb(localized.stageLabel ?? source.stageLabel));
    if (this.editMode) {
      items.push({ label: 'Edit' });
    }
    return items;
  }

  private breadcrumbItem(label: string, link: string[]): MenuItem {
    return this.editMode
      ? { label, linkClass: 'cursor-pointer', command: () => this.requestBreadcrumbNavigation(link) }
      : { label, routerLink: link };
  }

  private readerBreadcrumb(label: string): MenuItem {
    return this.editMode
      ? { label, linkClass: 'cursor-pointer', command: () => this.requestBreadcrumbNavigation() }
      : { label };
  }

  private requestBreadcrumbNavigation(link?: string[]) {
    if (!this.editMode) {
      if (link) {
        this.router.navigate(link);
      }
      return;
    }
    this.confirmation.confirm({
      key: 'transcript-actions',
      header: 'Leave editor?',
      message: 'Changes will not be saved. Do you want to exit?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Exit',
      rejectLabel: 'Keep editing',
      accept: () => {
        this.editMode = false;
        if (link) {
          this.router.navigate(link);
        } else {
          this.closeEditor();
        }
      },
    });
  }
  constructor() {
    if (!this.editMode) {
      this.store.clearStatusMessage();
    }
    effect(() => {
      const next = this.transcriptFromRoute();
      if (!next) {
        this.transcript = undefined;
        return;
      }
      if (next.id !== this.transcript?.id) {
        this.transcript = next;
        this.selections = {};
        this.store.loadTranscript(next.id);
        this.store.loadTranslations(next.id);
        this.editLanguage = next.sourceLanguage ?? 'en';
        this.applyEditLanguage(next);
      } else if (next !== this.transcript) {
        this.transcript = next;
        if (this.editMode && !this.isEditDirty) this.applyEditLanguage(next);
      }
    });
  }
  private transcriptFromRoute(): Transcript | undefined {
    const params: ParamMap = this.routeParams();
    const stageSlug = params.get('stageId');
    const partSlug = params.get('partId');
    const chapterSlug = params.get('chapterId');
    const eventSlug = params.get('eventId');
    const characterSlug = params.get('characterId');
    const routePath = this.route.snapshot.routeConfig?.path ?? '';
    const category = routePath.startsWith('event-story')
      ? 'event-story'
      : routePath.startsWith('eternal-nightmare')
        ? 'eternal-nightmare'
      : routePath.startsWith('main-story')
        ? 'main-story'
        : routePath.startsWith('perspectra')
          ? 'perspectra'
          : routePath.startsWith('mirage')
            ? 'mirage'
            : 'interrogation';
    return this.store.transcripts().find((item) => {
      if (stageSlug) {
        const parentSlug = chapterSlug ?? eventSlug;
        return (
          item.category === category &&
          !!parentSlug &&
          this.slug(item.parentLabel) === parentSlug &&
          this.slug(item.stageLabel || item.title) === stageSlug
        );
      }
      if (!partSlug || !characterSlug) {
        return false;
      }
      if (category === 'perspectra') {
        return (
          item.category === category &&
          this.slug(item.parentLabel) === characterSlug &&
          !!chapterSlug &&
          this.slug(item.stageLabel || item.title) === chapterSlug &&
          this.slug(item.title || item.stageLabel) === partSlug
        );
      }
      return (
        item.category === category &&
        this.slug(item.parentLabel) === characterSlug &&
        this.slug(item.title || item.stageLabel) === partSlug
      );
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
    this.persist(() => {
      if (next) {
        this.switchEditLanguage(next);
      }
    });
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

  public openEditor() {
    if (!this.auth.user() || !this.transcript) {
      return;
    }
    this.editMode = true;
    this.editLanguage = this.transcript.sourceLanguage ?? 'en';
    this.activeEditLanguage = this.editLanguage;
    this.applyEditLanguage(this.transcript);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { edit: '1' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  public closeEditor() {
    this.editMode = false;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { edit: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  public select(event: { id: string; option: string }) {
    this.selections = { ...this.selections, [event.id]: event.option };
  }

  public selectPreview(event: { id: string; option: string }) {
    this.previewSelections = { ...this.previewSelections, [event.id]: event.option };
  }

  public openPreview() {
    const editor = new TranscriptEditorComponent();
    editor.nodes = this.editNodes;
    this.previewNodes = editor.serialize();
    this.previewSelections = {};
    this.previewGender = this.store.gender();
    this.previewOpen = true;
  }

  public requestRead() {
    if (!this.editMode) {
      return;
    }
    if (!this.editNodes.length) {
      this.closeEditor();
      return;
    }
    this.confirmation.confirm({
      key: 'transcript-actions',
      header: 'Read transcript?',
      message: this.isEditDirty
        ? 'Unsaved changes will be discarded. Open the reader?'
        : 'Open the transcript in reader mode?',
      icon: 'pi pi-book',
      acceptLabel: 'Read transcript',
      rejectLabel: 'Keep editing',
      accept: () => this.closeEditor(),
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
    this.pendingImportName = '';
    this.pendingImportReady = false;
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
    this.importLoading = true;
    this.importProgress = 5;
    this.importMessage = 'Reading XLSX file in the browser...';
    this.importer
      .parseXlsx(file, (progress) => {
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
        next: (imported) => {
          this.importProgress = 100;
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
          this.importProgress = 0;
          this.pendingImportNodes = [];
          this.pendingImportName = '';
          this.pendingImportReady = false;
          this.importError = true;
          this.importMessage = 'Import failed: the browser could not parse the XLSX file.';
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
    void this.applyPendingImport();
  }

  private async applyPendingImport() {
    const helper = new TranscriptEditorComponent();
    helper.nodes = this.pendingImportNodes;
    const result = await this.storage.importRemoteMediaReferences(helper.serialize());
    this.editNodes = this.toEditable(result.nodes);
    this.pendingImportNodes = [];
    this.pendingImportName = '';
    this.pendingImportReady = false;
    this.editDirty = true;
    this.importError = result.unresolved > 0;
    this.importMessage = result.unresolved > 0
      ? this.language.text('importedWithUnresolvedImages', { count: String(result.unresolved) })
      : this.language.text('importedTranscript');
  }
  public save() {
    if (!this.transcript || !this.editNodes.length || this.saving) {
      return;
    }
    this.confirmation.confirm({
      key: 'transcript-actions',
      header: 'Save transcript?',
      message: 'Save the current transcript and return to the reader?',
      icon: 'pi pi-save',
      acceptLabel: 'Save transcript',
      rejectLabel: 'Cancel',
      accept: () => this.persist(() => this.returnToReader()),
    });
  }

  private persist(onSuccess: () => void) {
    if (!this.transcript || !this.editNodes.length || this.saving) {
      return;
    }
    this.saving = true;
    const helper = new TranscriptEditorComponent();
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
      this.store.update(
        updated,
        (saved) => {
          this.saving = false;
          this.transcript = saved;
          this.captureEditSnapshot();
          onSuccess();
        },
        () => (this.saving = false),
      );
    } else {
      this.store.saveTranslation(
        this.transcript.id,
        this.editLanguage,
        {
          title: updated.title,
          parentLabel: updated.parentLabel,
          stageLabel: updated.stageLabel,
          description: updated.description,
          nodes: updated.nodes,
        },
        () => {
          this.saving = false;
          this.transcript = this.store.transcripts().find((item) => item.id === updated.id) ?? updated;
          this.captureEditSnapshot();
          onSuccess();
        },
        () => (this.saving = false),
      );
    }
  }

  private returnToReader() {
    if (!this.transcript) {
      return;
    }
    const transcript = this.transcript;
    const path = ['/', transcript.category, this.slug(transcript.parentLabel)];
    if (transcript.category === 'perspectra') {
      path.push(this.slug(transcript.stageLabel), this.slug(transcript.title || transcript.stageLabel));
    } else {
      path.push(this.slug(transcript.category === 'interrogation' || transcript.category === 'mirage'
        ? transcript.title || transcript.stageLabel
        : transcript.stageLabel || transcript.title));
    }
    this.editMode = false;
    this.router.navigate(path, { replaceUrl: true });
  }

  public remove() {
    if (!this.transcript || this.deleting) {
      return;
    }
    this.confirmation.confirm({
      key: 'transcript-actions',
      header: 'Delete transcript?',
      message: 'This transcript and its translations will be permanently deleted.',
      icon: 'pi pi-trash',
      acceptLabel: 'Delete transcript',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        if (!this.transcript) {
          return;
        }
        this.deleting = true;
        const destination = this.backLink;
        this.store.remove(
          this.transcript.id,
          () => this.router.navigate(destination),
          () => (this.deleting = false),
        );
      },
    });
  }
  private toEditable(nodes: DialogueNode[]): EditableNode[] {
    return nodes.map((node) =>
      node.type === 'line'
        ? {
            type: 'line',
            id: node.id,
            speaker: node.speaker ?? '',
            sprite: node.sprite ?? '',
            text: node.text ?? node.description ?? '',
            male: node.variants?.male ?? '',
            female: node.variants?.female ?? '',
          }
        : node.type === 'choice'
          ? this.choice(node)
          : this.image(node),
    );
  }

  private image(node: ImageNode): EditableNode {
    return { type: 'image', id: node.id, src: node.src };
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
