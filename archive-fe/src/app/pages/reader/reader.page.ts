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
import { TextareaModule } from 'primeng/textarea';
import { ImageModule } from 'primeng/image';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import {
  Category,
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
import {
  ImportLanguageOption,
  ImportedTranscriptMetadata,
  TranscriptImportService,
} from '../../services/transcript-import.service';
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
    TextareaModule,
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

  public get missingBreadcrumbItems(): MenuItem[] {
    return [{ label: this.language.text('notFound') }];
  }

  public readonly language = inject(LanguageService);

  public selections: Record<string, string> = {};

  public chiefName = this.readStoredChiefName();

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

  public editMode = false;

  public editLanguage: LanguageCode = 'en';

  public get assetOwnerId() {
    return this.transcript ? `${this.transcript.id}/${this.editLanguage}` : '';
  }

  public pendingEditLanguage: LanguageCode | null = null;

  public showLanguagePrompt = false;

  public editParent = '';

  public editStage = '';

  public editName = '';

  public editDescription = '';

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

  private pendingImportMetadata: ImportedTranscriptMetadata = {};

  public importLanguageOptions: ImportLanguageOption[] = [];

  public importLanguage = '';

  private importFileSource: File | null = null;

  public pendingImportName = '';

  public pendingImportReady = false;

  public importApplying = false;

  public importError = false;

  public importProgress = 0;

  public readonly maxImportFileSize = 100_000_000;

  private activeEditLanguage: LanguageCode = 'en';

  private editSnapshot = '';

  private editDirty = false;

  private readonly editRequested = this.route.snapshot.queryParamMap.get('edit') === '1';

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
    const transcript = this.transcript
      ? this.store.transcripts().find((item) => item.id === this.transcript?.id) ?? this.transcript
      : undefined;
    if (!transcript || this.store.transcriptUnavailable() === transcript.id) {
      return undefined;
    }
    const selectedLanguage = this.language.current().trim().toLowerCase();
    const translation = Object.entries(transcript.translations ?? {}).find(
      ([language]) => language.trim().toLowerCase() === selectedLanguage,
    )?.[1];
    return translation
      ? { ...transcript, ...translation, nodes: translation.nodes ?? transcript.nodes }
      : transcript;
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

    const choices = this.store.collections(category).map((collection) => ({
      label: collection.localizedLabel,
      value: collection.label,
    }));
    const current = this.editParent.trim();

    if (current && !choices.some((choice) => choice.value === current)) {
      choices.unshift({ label: current, value: current });
    }

    return choices;
  }

  public get breadcrumbItems(): MenuItem[] {
    if (!this.transcript) {
      return [{ label: this.language.text('notFound') }];
    }
    const source = this.transcript;
    const localized = this.localizedTranscript ?? source;
    const categoryLabels: Record<string, string> = {
      'main-story': this.language.text('mainStory'),
      'eternal-nightmare': this.language.text('eternalNightmare'),
      'event-story': this.language.text('eventStory'),
      interrogation: this.language.text('interrogation'),
      mirage: this.language.text('mirage'),
      perspectra: this.language.text('perspectra'),
    };
    const categoryLink = ['/', source.category];
    const parentLink = ['/', source.category, this.slug(source.parentLabel)];
    const parentLabel = this.localizedParentLabel(source, localized);
    const items: MenuItem[] = [
      this.breadcrumbItem(categoryLabels[source.category] ?? source.category, categoryLink),
      this.breadcrumbItem(parentLabel, parentLink),
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
        items.push({ label: this.language.text('edit') });
      }
      return items;
    }
    items.push(this.readerBreadcrumb(localized.stageLabel ?? source.stageLabel));
    if (this.editMode) {
      items.push({ label: this.language.text('edit') });
    }
    return items;
  }

  private localizedParentLabel(source: Transcript, localized: Transcript): string {
    const collection = this.store.collections(source.category).find(
      (item) => item.id === source.parentId || item.label === source.parentLabel,
    );
    return collection?.localizedLabel ?? localized.parentLabel ?? source.parentLabel;
  }

  private breadcrumbItem(label: string, link: string[]): MenuItem {
    return this.editMode
      ? {
          label,
          linkClass: 'cursor-pointer',
          command: () => this.requestBreadcrumbNavigation(link),
        }
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
      header: this.language.text('leaveEditor'),
      message: this.language.text('leaveEditorMessage'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.language.text('exit'),
      rejectLabel: this.language.text('keepEditing'),
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
    void this.store.ensureCollectionLoadedBySlug(this.routeCategory(), this.routeParentSlug());
    this.auth.me().subscribe((user) => {
      if (user && this.editRequested) {
        this.editMode = true;
      }
    });
    this.store.clearStatusMessage();
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
  private routeParentSlug(): string {
    const params = this.route.snapshot.paramMap;
    if (this.routeCategory() === 'perspectra') {
      return params.get('characterId') ?? '';
    }
    return params.get('chapterId') ?? params.get('eventId') ?? params.get('characterId') ?? '';
  }

  private routeCategory(): Category {
    const routePath = this.route.snapshot.routeConfig?.path ?? '';
    return routePath.startsWith('event-story')
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
        JSON.stringify({
          parent: this.editParent,
          stage: this.editStage,
          name: this.editName,
          description: this.editDescription,
          nodes: this.editNodes,
        })
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
      this.editName = transcript.title;
      this.editDescription = transcript.description;
      this.editNodes = this.toEditable(transcript.nodes);
      this.captureEditSnapshot();
      return;
    }
    this.editParent = translation.parentLabel ?? transcript.parentLabel;
    this.editStage = translation.stageLabel ?? transcript.stageLabel;
    this.editName = translation.title ?? transcript.title;
    this.editDescription = translation.description ?? transcript.description;
    this.editNodes = this.toEditable(translation.nodes ?? transcript.nodes);
    this.captureEditSnapshot();
  }
  public chiefNameChanged(value: string) {
    this.chiefName = value;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('archive-chief-name', value);
    }
  }

  private readStoredChiefName(): string {
    if (typeof localStorage === 'undefined') {
      return '';
    }
    return localStorage.getItem('archive-chief-name') ?? '';
  }

  private captureEditSnapshot() {
    this.editSnapshot = JSON.stringify({
      parent: this.editParent,
      stage: this.editStage,
      name: this.editName,
      description: this.editDescription,
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

  public async openPreview() {
    const editor = new TranscriptEditorComponent();
    editor.nodes = this.editNodes;
    const nodes = editor.serialize();
    await this.storage
      .resolveMediaReferences(this.storage.mediaReferences(nodes))
      .catch(() => undefined);
    this.previewNodes = this.storage.toPublicNodes(nodes);
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
      header: this.language.text('readTranscriptPrompt'),
      message: this.isEditDirty
        ? this.language.text('discardAndRead')
        : this.language.text('readTranscriptMessage'),
      icon: 'pi pi-book',
      acceptLabel: this.language.text('read'),
      rejectLabel: this.language.text('keepEditing'),
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
      this.importMessage = this.language.text('importWrongType');
      return;
    }
    if (!file.size) {
      this.importError = true;
      this.importMessage = this.language.text('importEmpty');
      return;
    }
    if (file.size > this.maxImportFileSize) {
      this.importError = true;
      this.importMessage = this.language.text('importTooLarge');
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
    this.importMessage = this.language.text('loadingXlsx');
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
            ? this.language.text('readyToImport', {
                count: String(this.pendingImportNodes.length),
              })
            : this.language.text('importNoRows');
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
              : this.language.text('importBackendFailed');
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
      !confirm(this.language.text('replaceEditsMessage'))
    ) {
      return;
    }
    void this.applyPendingImport();
  }

  private async applyPendingImport() {
    if (this.importApplying) {
      return;
    }
    this.importApplying = true;
    this.importError = false;
    this.importMessage = this.language.text('resolvingImportImages');
    try {
      const helper = new TranscriptEditorComponent();
      helper.nodes = this.pendingImportNodes;
      const result = await this.storage.importRemoteMediaReferences(helper.serialize());
      this.editName = this.pendingImportMetadata.name ?? this.editName;
      this.editStage = this.pendingImportMetadata.stage ?? this.editStage;
      this.editDescription = this.pendingImportMetadata.description ?? this.editDescription;
      this.editNodes = this.toEditable(result.nodes);
      this.pendingImportNodes = [];
      this.pendingImportMetadata = {};
      this.pendingImportName = '';
      this.pendingImportReady = false;
      this.editDirty = true;
      this.importError = result.unresolved > 0;
      this.importMessage =
        result.unresolved > 0
          ? this.language.text('importedWithUnresolvedImages', {
              count: String(result.unresolved),
            })
          : this.language.text('importedLines', { count: String(this.editNodes.length) });
    } catch (error: unknown) {
      this.importError = true;
      this.importMessage =
        error instanceof Error
          ? error.message
          : this.language.text('importImagesFailed');
    } finally {
      this.importApplying = false;
      this.cdr.markForCheck();
    }
  }
  public save() {
    if (!this.transcript || !this.editNodes.length || this.saving) {
      return;
    }
    this.confirmation.confirm({
      key: 'transcript-actions',
      header: this.language.text('saveTranscriptPrompt'),
      message: this.language.text('saveTranscriptMessage'),
      icon: 'pi pi-save',
      acceptLabel: this.language.text('save'),
      rejectLabel: this.language.text('cancel'),
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
      title: this.editName,
      description: this.editDescription,
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
          this.transcript =
            this.store.transcripts().find((item) => item.id === updated.id) ?? updated;
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
      path.push(
        this.slug(transcript.stageLabel),
        this.slug(transcript.title || transcript.stageLabel),
      );
    } else {
      path.push(
        this.slug(
          transcript.category === 'interrogation' || transcript.category === 'mirage'
            ? transcript.title || transcript.stageLabel
            : transcript.stageLabel || transcript.title,
        ),
      );
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
      header: this.language.text('deleteTranscriptPrompt'),
      message: this.language.text('deleteTranscriptMessage'),
      icon: 'pi pi-trash',
      acceptLabel: this.language.text('delete'),
      rejectLabel: this.language.text('cancel'),
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
            options: (node.options ?? []).map((option) => ({
              id: option.id,
              label: option.label,
              nodes: this.toEditable(option.nodes),
            })),
          }
        : this.image(node),
    );
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
}
