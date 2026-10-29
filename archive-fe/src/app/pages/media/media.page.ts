import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MenuItem, TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { ImageModule } from 'primeng/image';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PaginatorModule } from 'primeng/paginator';
import { TreeModule } from 'primeng/tree';
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
    BreadcrumbModule,
    ConfirmDialogModule,
    DialogModule,
    FileUploadModule,
    ImageModule,
    InputTextModule,
    MessageModule,
    PaginatorModule,
    TreeModule,
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
  public importUrl = '';
  public moveDialogVisible = false;
  public movingAsset: MediaAsset | null = null;
  public moveTargetFolderId: string | null = null;
  public readonly breadcrumbHome: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  public get breadcrumbItems(): MenuItem[] {
    return [{ label: this.language.text('mediaLibrary') }];
  }

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

  public searchChanged() {
    this.page = 0;
    void this.load();
  }

  public pageChanged(event: { page?: number }) {
    this.page = event.page ?? 0;
    void this.load();
  }

  public imageUrl(asset: MediaAsset): string {
    return this.storage.toPublicUrl(mediaReference(asset.id)) ?? '';
  }

  public imagePath(asset: MediaAsset): string {
    const name = asset.displayName.trim().replace(/\.(?:avif|gif|jpe?g|png|webp)$/i, '');
    const folder = asset.folderId
      ? this.folders.find((item) => item.id === asset.folderId)
      : undefined;
    const path = folder
      ? this.folderAncestors(folder.id)
          .map((ancestor) => ancestor.name.trim())
          .join('/')
      : '';
    return path ? `${path}/${name}` : name;
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

  public get visibleFolders(): MediaFolder[] {
    return this.folders.filter(
      (folder) => (folder.parentId ?? null) === (this.selectedFolderId ?? null),
    );
  }

  public get folderOptions(): { id: string; name: string }[] {
    return this.folders.map((folder) => ({ id: folder.id, name: this.folderPath(folder) }));
  }

  public get folderTree(): TreeNode[] {
    const nodes = new Map<string | null, TreeNode[]>();
    for (const folder of this.folders) {
      const node: TreeNode = {
        key: folder.id,
        label: folder.name,
        data: folder,
        icon: 'pi pi-folder',
        children: [],
        expanded: true,
      };
      const siblings = nodes.get(folder.parentId ?? null) ?? [];
      siblings.push(node);
      nodes.set(folder.parentId ?? null, siblings);
    }
    const attachChildren = (items: TreeNode[]) => {
      for (const node of items) {
        if (node.key !== '__unfiled') {
          node.children = nodes.get(node.key ?? null) ?? [];
        }
        attachChildren(node.children ?? []);
      }
    };
    const roots = nodes.get(null) ?? [];
    attachChildren(roots);
    return [
      {
        key: '__unfiled',
        label: this.language.text('unfiledImages'),
        data: null,
        icon: 'pi pi-inbox',
      },
      ...roots,
    ];
  }

  public get moveTargetFolderName(): string {
    if (!this.moveTargetFolderId) return this.language.text('unfiledImages');
    const folder = this.folders.find((item) => item.id === this.moveTargetFolderId);
    return folder ? this.folderPath(folder) : this.language.text('unfiledImages');
  }

  public get moveSelectionKeys(): Record<string, boolean> {
    return { [this.moveTargetFolderId ?? '__unfiled']: true };
  }

  public get currentFolderName(): string {
    return this.folders.find((folder) => folder.id === this.selectedFolderId)?.name ?? '';
  }

  public get parentFolderId(): string | null {
    return this.folders.find((folder) => folder.id === this.selectedFolderId)?.parentId ?? null;
  }

  public get folderBreadcrumbs(): MenuItem[] {
    const items: MenuItem[] = [
      {
        label: this.language.text('allImages'),
        styleClass: 'cursor-pointer hover:underline',
        command: () => this.folderChanged(''),
      },
    ];
    const path = this.selectedFolderId ? this.folderAncestors(this.selectedFolderId) : [];
    path.forEach((folder, index) => {
      items.push({
        label: folder.name,
        disabled: index === path.length - 1,
        styleClass: index === path.length - 1 ? '' : 'cursor-pointer hover:underline',
        command: () => this.folderChanged(folder.id),
      });
    });
    return items;
  }

  public folderPath(folder: MediaFolder): string {
    return this.folderAncestors(folder.id)
      .map((ancestor) => ancestor.name)
      .join(' / ');
  }

  private folderAncestors(folderId: string): MediaFolder[] {
    const ancestors: MediaFolder[] = [];
    const visited = new Set<string>();
    let current: MediaFolder | undefined = this.folders.find((folder) => folder.id === folderId);
    while (current && !visited.has(current.id)) {
      ancestors.unshift(current);
      visited.add(current.id);
      current = current.parentId
        ? this.folders.find((candidate) => candidate.id === current?.parentId)
        : undefined;
    }
    return ancestors;
  }

  public async createFolder() {
    const name = this.folderName.trim();
    if (!name) return;
    try {
      await this.storage.createMediaFolder(name, this.selectedFolderId);
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

  public openMoveDialog(asset: MediaAsset) {
    this.movingAsset = asset;
    this.moveTargetFolderId = asset.folderId ?? null;
    this.moveDialogVisible = true;
  }

  public closeMoveDialog() {
    this.moveDialogVisible = false;
    this.movingAsset = null;
    this.moveTargetFolderId = null;
  }

  public selectMoveTarget(node: TreeNode) {
    this.moveTargetFolderId = node.key === '__unfiled' ? null : String(node.key);
  }

  public async confirmMove() {
    if (!this.movingAsset) return;
    const asset = this.movingAsset;
    const folderId = this.moveTargetFolderId;
    this.closeMoveDialog();
    if ((asset.folderId ?? null) === folderId) return;
    try {
      await this.storage.moveMediaAsset(asset.id, folderId);
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
