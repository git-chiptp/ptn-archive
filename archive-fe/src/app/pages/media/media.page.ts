import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
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
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ConfirmDialogModule,
    FileUploadModule,
    ImageModule,
    InputTextModule,
    MessageModule,
    PaginatorModule,
  ],
  templateUrl: './media.page.html',
})
export class MediaPage {
  readonly language = inject(LanguageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly storage = inject(ArchiveStorageService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  public assets: MediaAsset[] = [];
  public folders: MediaFolder[] = [];
  public search = '';
  public page = 0;
  public total = 0;
  public selectedFolderId: string | null = null;
  public folderName = '';
  public editingFolder: MediaFolder | null = null;
  public editingFolderName = '';
  public loading = false;
  public error = '';
  public status = '';
  public editing: MediaAsset | null = null;
  public editingName = '';
  public replacing: MediaAsset | null = null;
  public importUrl = '';

  constructor() {
    void this.load();
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

  public openFolder(folderId: string) {
    this.folderChanged(folderId);
  }

  public showRoot() {
    this.folderChanged('');
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

  public imagePath(asset: MediaAsset): string {
    const name = asset.displayName.trim().replace(/\.(?:avif|gif|jpe?g|png|webp)$/i, '');
    const folder = this.folders.find((item) => item.id === asset.folderId)?.name.trim();
    return folder ? `${folder}/${name}` : name;
  }

  public async copyImagePath(asset: MediaAsset) {
    const path = this.imagePath(asset);
    try {
      await this.copyToClipboard(path);
      this.error = '';
      this.status = this.language.text('imagePathCopied', { path });
    } catch {
      this.error = this.language.text('copyImagePathFailed');
    }
  }

  public get currentFolderName(): string {
    return this.folders.find((folder) => folder.id === this.selectedFolderId)?.name ?? '';
  }

  public async createFolder() {
    const name = this.folderName.trim();
    if (!name) return;
    try {
      await this.storage.createMediaFolder(name);
      this.folderName = '';
      this.status = this.language.text('folderCreated');
      await this.load();
    } catch {
      this.error = this.language.text('folderSaveFailed');
    }
  }

  public startRenameFolder(folder: MediaFolder) {
    this.editingFolder = folder;
    this.editingFolderName = folder.name;
  }

  public async saveRenameFolder() {
    if (!this.editingFolder || !this.editingFolderName.trim()) return;
    try {
      await this.storage.renameMediaFolder(this.editingFolder.id, this.editingFolderName);
      this.editingFolder = null;
      this.status = this.language.text('folderRenamed');
      await this.load();
    } catch {
      this.error = this.language.text('folderSaveFailed');
    }
  }

  public removeFolder(folder: MediaFolder) {
    this.confirmation.confirm({
      key: 'media-folder-actions',
      header: this.language.text('deleteFolder'),
      message: this.language.text('deleteFolderMessage', { name: folder.name }),
      icon: 'pi pi-trash',
      acceptLabel: this.language.text('deleteFolder'),
      rejectLabel: this.language.text('cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        try {
          await this.storage.removeMediaFolder(folder.id);
          if (this.selectedFolderId === folder.id) this.selectedFolderId = '';
          this.status = this.language.text('folderDeleted');
          await this.load();
        } catch {
          this.error = this.language.text('folderDeleteFailed');
        }
      },
    });
  }

  public async moveAsset(asset: MediaAsset, folderId: string) {
    try {
      await this.storage.moveMediaAsset(asset.id, folderId || null);
      this.status = this.language.text('mediaMoved');
      await this.load();
    } catch {
      this.error = this.language.text('mediaMoveFailed');
    }
  }

  public async upload(input: File[] | FileList | Event) {
    const file = Array.isArray(input)
      ? input[0]
      : 'target' in input
        ? (input.target as HTMLInputElement | null)?.files?.[0]
        : (input.item(0) ?? undefined);
    if (!file) return;
    this.error = '';
    try {
      await this.storage.createMediaAsset(
        file,
        file.name,
        undefined,
        undefined,
        this.selectedFolderId === '__unfiled' ? null : this.selectedFolderId || null,
      );
      this.status = this.language.text('mediaUploaded');
      await this.load();
    } catch (error) {
      this.error = error instanceof Error ? error.message : this.language.text('mediaUploadFailed');
    }
  }

  public async import() {
    const url = this.importUrl.trim();
    if (!url) return;
    this.error = '';
    try {
      await this.storage.importMediaUrl(
        url,
        undefined,
        undefined,
        this.selectedFolderId === '__unfiled' ? null : this.selectedFolderId || null,
      );
      this.importUrl = '';
      this.status = this.language.text('mediaImported');
      await this.load();
    } catch {
      this.error = this.language.text('mediaImportFailed');
    }
  }

  public startRename(asset: MediaAsset) {
    this.editing = asset;
    this.editingName = asset.displayName;
  }

  public async saveRename() {
    if (!this.editing) return;
    try {
      await this.storage.renameMediaAsset(this.editing.id, this.editingName);
      this.editing = null;
      this.status = this.language.text('mediaRenamed');
      await this.load();
    } catch {
      this.error = this.language.text('mediaRenameFailed');
    }
  }

  public async replace(asset: MediaAsset, input: File[] | FileList | Event) {
    const file = Array.isArray(input)
      ? input[0]
      : 'target' in input
        ? (input.target as HTMLInputElement | null)?.files?.[0]
        : (input.item(0) ?? undefined);
    if (!file) return;
    this.replacing = asset;
    this.error = '';
    try {
      await this.storage.replaceMediaAsset(asset.id, file);
      this.status = this.language.text('mediaReplaced');
      await this.load();
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : this.language.text('mediaReplaceFailed');
    } finally {
      this.replacing = null;
    }
  }

  public async remove(asset: MediaAsset) {
    this.error = '';
    try {
      await this.storage.removeMediaAsset(asset.id);
      this.status = this.language.text('mediaDeleted');
      await this.load();
    } catch {
      this.error = this.language.text('mediaDeleteFailed');
    }
  }

  private async copyToClipboard(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    try {
      if (!document.execCommand('copy')) {
        throw new Error('Clipboard copy failed.');
      }
    } finally {
      input.remove();
    }
  }
}
