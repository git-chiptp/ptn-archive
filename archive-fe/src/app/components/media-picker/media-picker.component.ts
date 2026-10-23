import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { ImageModule } from 'primeng/image';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PaginatorModule } from 'primeng/paginator';
import {
  ArchiveStorageService,
  MediaAsset,
  MediaFolder,
  mediaReference,
} from '../../services/archive-storage.service';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-media-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    FileUploadModule,
    ImageModule,
    InputTextModule,
    MessageModule,
    PaginatorModule,
  ],
  templateUrl: './media-picker.component.html',
})
export class MediaPickerComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() value = '';
  @Output() selected = new EventEmitter<string>();
  @Input() title = '';

  readonly language = inject(LanguageService);
  private readonly storage = inject(ArchiveStorageService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  public assets: MediaAsset[] = [];
  public folders: MediaFolder[] = [];
  public selectedFolderId: string | null = null;
  public search = '';
  public importUrl = '';
  public page = 0;
  public total = 0;
  public loading = false;
  public saving = false;
  public error = '';

  public ngOnChanges(changes: SimpleChanges) {
    if (changes['visible']?.currentValue && !changes['visible'].previousValue) {
      void this.load();
    }
  }

  public async load() {
    this.loading = true;
    this.error = '';
    try {
      const [folders, result] = await Promise.all([
        this.storage.listMediaFolders(),
        this.storage.listMediaAssets(this.search, 24, this.page * 24, this.selectedFolderId),
      ]);
      this.folders = folders;
      this.assets = result.assets;
      this.total = result.total;
    } catch {
      this.error = this.language.text('mediaLoadFailed');
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }

  public folderChanged(folderId: string) {
    this.selectedFolderId = folderId || null;
    this.page = 0;
    void this.load();
  }

  public searchChanged() {
    this.page = 0;
    void this.load();
  }

  public pageChanged(event: { page?: number }) {
    this.page = event.page ?? 0;
    void this.load();
  }

  public imageUrl(asset: MediaAsset): string {
    return this.storage.toPublicUrl(mediaReference(asset.id)) ?? mediaReference(asset.id);
  }

  public get currentFolderName(): string {
    return this.folders.find((folder) => folder.id === this.selectedFolderId)?.name ?? '';
  }

  public choose(asset: MediaAsset) {
    this.selected.emit(mediaReference(asset.id));
    this.close();
  }

  public clear() {
    this.selected.emit('');
    this.close();
  }

  public async upload(input: File[] | FileList | Event) {
    const file = Array.isArray(input)
      ? input[0]
      : 'target' in input
        ? (input.target as HTMLInputElement | null)?.files?.[0]
        : (input.item(0) ?? undefined);
    if (!file) return;
    this.saving = true;
    this.error = '';
    try {
      const asset = await this.storage.createMediaAsset(
        file,
        file.name,
        undefined,
        undefined,
        this.selectedFolderId === '__unfiled' ? null : this.selectedFolderId || null,
      );
      this.selected.emit(mediaReference(asset.id));
      this.close();
    } catch (error) {
      this.error = error instanceof Error ? error.message : this.language.text('mediaUploadFailed');
    } finally {
      this.saving = false;
    }
  }

  public async import() {
    const url = this.importUrl.trim();
    if (!url) return;
    this.saving = true;
    this.error = '';
    try {
      const asset = await this.storage.importMediaUrl(
        url,
        undefined,
        undefined,
        this.selectedFolderId === '__unfiled' ? null : this.selectedFolderId || null,
      );
      this.selected.emit(mediaReference(asset.id));
      this.close();
    } catch {
      this.error = this.language.text('mediaImportFailed');
    } finally {
      this.saving = false;
    }
  }

  public close() {
    this.visibleChange.emit(false);
    this.importUrl = '';
    this.error = '';
  }
}
