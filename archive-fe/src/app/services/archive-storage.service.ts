import { Injectable, inject, signal } from '@angular/core';
import { DialogueNode } from '../models/transcript.models';
import { environment } from '../../environments/environment';
import { SUPABASE_CLIENT } from './supabase.client';

export const ARCHIVE_ASSET_BUCKET = 'archive-assets';
export const ARCHIVE_ASSET_MAX_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const STORAGE_PATH_PATTERN =
  /^(?:chapters|archives)\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.[A-Za-z0-9]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MEDIA_REFERENCE_PATTERN = /^media:([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i;
const MEDIA_OBJECT_PATH_PATTERN =
  /^media\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.(?:avif|gif|jpg|png|webp)$/i;
const RASTER_DATA_URL_PATTERN = /^data:image\/(?:avif|gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i;

export type MediaFolder = {
  id: string;
  name: string;
};

export type MediaAsset = {
  id: string;
  displayName: string;
  objectKey: string;
  provider: 'supabase' | 'r2';
  mimeType: string;
  byteSize: number;
  folderId?: string;
  originalUrl?: string;
  attribution?: string;
};

type MediaAssetRow = {
  id: string;
  display_name: string;
  object_key: string;
  provider: 'supabase' | 'r2';
  mime_type: string;
  byte_size: number;
  folder_id: string | null;
  original_url: string | null;
  attribution: string | null;
};

type MediaFolderRow = {
  id: string;
  name: string;
};

type ImportedMediaResponse = {
  asset?: MediaAssetRow;
  reference?: string;
};

type R2MediaResponse = ImportedMediaResponse;

function isStoragePath(value: string): boolean {
  return STORAGE_PATH_PATTERN.test(value) || MEDIA_OBJECT_PATH_PATTERN.test(value);
}

export function mediaReference(assetId: string): string {
  if (!UUID_PATTERN.test(assetId)) {
    throw new Error('Invalid media asset ID.');
  }
  return `media:${assetId.toLowerCase()}`;
}

export function isMediaReference(value: string): boolean {
  return MEDIA_REFERENCE_PATTERN.test(value.trim());
}

export function isRemoteImageUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function mediaObjectPath(assetId: string, mimeType: string): string {
  if (!UUID_PATTERN.test(assetId)) {
    throw new Error('Invalid media asset ID.');
  }
  const extension = IMAGE_EXTENSIONS[mimeType];
  if (!extension) {
    throw new Error('Unsupported image type.');
  }
  return `media/${assetId.toLowerCase()}/${crypto.randomUUID()}.${extension}`;
}

export function isAllowedImageSource(value: string): boolean {
  const source = value.trim();
  try {
    const url = new URL(source);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return isStoragePath(source);
  }
}

export function isRenderableImageSource(value: string): boolean {
  return isAllowedImageSource(value) || RASTER_DATA_URL_PATTERN.test(value.trim());
}

@Injectable({ providedIn: 'root' })
export class ArchiveStorageService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  private readonly mediaUrls = new Map<string, string>();

  private readonly mediaReferencesByUrl = new Map<string, string>();

  private readonly mediaAssets = new Map<string, MediaAsset>();

  private readonly orphanedUploadKeySet = new Set<string>();

  public readonly pendingUploads = signal(0);

  public async replaceImage(
    file: File,
    _previousValue: string | undefined,
    path: string,
  ): Promise<string> {
    return this.uploadImage(file, path);
  }

  public async uploadImage(file: File, path: string): Promise<string> {
    await this.validateImage(file);
    if (!isStoragePath(path)) {
      throw new Error('Invalid archive image path.');
    }
    this.pendingUploads.update((count) => count + 1);
    try {
      const { error } = await this.supabase.storage.from(ARCHIVE_ASSET_BUCKET).upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: !MEDIA_OBJECT_PATH_PATTERN.test(path),
      });
      if (error) {
        throw error;
      }
      return path;
    } finally {
      this.pendingUploads.update((count) => Math.max(0, count - 1));
    }
  }

  public async importMediaUrl(
    url: string,
    displayName?: string,
    attribution?: string,
    folderId?: string | null,
  ): Promise<MediaAsset> {
    const data = this.usesR2()
      ? await this.r2Request<R2MediaResponse>('/media/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url, displayName, attribution, folderId: folderId ?? null }),
        })
      : await this.supabase.functions
          .invoke<ImportedMediaResponse>('import-media-url', {
            body: { url, displayName, attribution, folderId: folderId ?? null },
          })
          .then(({ data, error }) => {
            if (error) throw error;
            return data;
          });
    if (!data?.asset) {
      throw new Error('The image import did not return an asset.');
    }
    const asset = this.mediaAssetFromRow(data.asset);
    this.rememberMediaAsset(asset);
    return asset;
  }

  public async createMediaAsset(
    file: File,
    displayName = file.name,
    originalUrl?: string,
    attribution?: string,
    folderId?: string | null,
  ): Promise<MediaAsset> {
    await this.validateImage(file);
    if (this.usesR2()) {
      const form = new FormData();
      form.set('file', file);
      form.set('displayName', displayName.trim() || file.name);
      if (originalUrl) form.set('originalUrl', originalUrl);
      if (attribution) form.set('attribution', attribution);
      if (folderId) form.set('folderId', folderId);
      const data = await this.r2Request<R2MediaResponse>('/media/upload', {
        method: 'POST',
        body: form,
      });
      if (!data.asset) throw new Error('The image upload did not return an asset.');
      const asset = this.mediaAssetFromRow(data.asset);
      this.rememberMediaAsset(asset);
      return asset;
    }
    const id = crypto.randomUUID();
    const objectKey = mediaObjectPath(id, file.type);
    await this.uploadImage(file, objectKey);
    const { data, error } = await this.supabase
      .from('media_assets')
      .insert({
        id,
        display_name: displayName.trim() || file.name,
        object_key: objectKey,
        provider: 'supabase',
        mime_type: file.type,
        byte_size: file.size,
        folder_id: folderId ?? null,
        original_url: originalUrl ?? null,
        attribution: attribution ?? null,
      })
      .select(
        'id,display_name,object_key,provider,mime_type,byte_size,folder_id,original_url,attribution',
      )
      .single();
    if (error) {
      this.orphanedUploadKeySet.add(objectKey);
      throw error;
    }
    const asset = this.mediaAssetFromRow(data as MediaAssetRow);
    this.rememberMediaAsset(asset);
    return asset;
  }

  public async renameMediaAsset(assetId: string, displayName: string): Promise<MediaAsset> {
    const name = displayName.trim();
    if (!name) {
      throw new Error('Media asset name is required.');
    }
    const { data, error } = await this.supabase
      .from('media_assets')
      .update({ display_name: name })
      .eq('id', assetId.toLowerCase())
      .select(
        'id,display_name,object_key,provider,mime_type,byte_size,folder_id,original_url,attribution',
      )
      .single();
    if (error) {
      throw error;
    }
    const asset = this.mediaAssetFromRow(data as MediaAssetRow);
    this.rememberMediaAsset(asset);
    return asset;
  }

  public async replaceMediaAsset(assetId: string, file: File): Promise<MediaAsset> {
    await this.validateImage(file);
    const current = await this.getMediaAsset(assetId);
    if (this.usesR2() && current.provider === 'r2') {
      const form = new FormData();
      form.set('file', file);
      const data = await this.r2Request<R2MediaResponse>(`/media/replace/${current.id}`, {
        method: 'POST',
        body: form,
      });
      if (!data.asset) throw new Error('The image replacement did not return an asset.');
      const replacement = this.mediaAssetFromRow(data.asset);
      this.rememberMediaAsset(replacement);
      return replacement;
    }
    const objectKey = mediaObjectPath(current.id, file.type);
    await this.uploadImage(file, objectKey);
    const { data, error } = await this.supabase
      .from('media_assets')
      .update({
        object_key: objectKey,
        provider: 'supabase',
        mime_type: file.type,
        byte_size: file.size,
      })
      .eq('id', current.id)
      .select(
        'id,display_name,object_key,provider,mime_type,byte_size,folder_id,original_url,attribution',
      )
      .single();
    if (error) {
      this.orphanedUploadKeySet.add(objectKey);
      throw error;
    }
    const replacement = this.mediaAssetFromRow(data as MediaAssetRow);
    this.rememberMediaAsset(replacement);
    if (current.provider === 'supabase') {
      await this.removeObjectKeys([current.objectKey]);
    }
    return replacement;
  }

  public async getMediaAsset(assetId: string): Promise<MediaAsset> {
    if (!UUID_PATTERN.test(assetId)) {
      throw new Error('Invalid media asset ID.');
    }
    const { data, error } = await this.supabase
      .from('media_assets')
      .select(
        'id,display_name,object_key,provider,mime_type,byte_size,folder_id,original_url,attribution',
      )
      .eq('id', assetId.toLowerCase())
      .single();
    if (error) {
      throw error;
    }
    return this.mediaAssetFromRow(data as MediaAssetRow);
  }

  public async removeMediaAsset(assetId: string): Promise<void> {
    const asset = await this.getMediaAsset(assetId);
    if (this.usesR2() && asset.provider === 'r2') {
      await this.r2Request(`/media/delete/${asset.id}`, { method: 'DELETE' });
    } else {
      const { error } = await this.supabase.from('media_assets').delete().eq('id', asset.id);
      if (error) throw error;
      if (asset.provider === 'supabase') await this.removeObjectKeys([asset.objectKey]);
    }
    this.mediaUrls.delete(mediaReference(asset.id));
  }

  public get orphanedUploadKeys(): string[] {
    return [...this.orphanedUploadKeySet];
  }

  public imagePath(
    ownerId: string,
    kind: 'background' | 'image' | 'sprite',
    nodeId: string,
    file: File,
  ): string {
    const owner = this.safePath(ownerId);
    const node = this.safeSegment(nodeId);
    const extension = IMAGE_EXTENSIONS[file.type];
    if (!extension) {
      throw new Error('Unsupported image type.');
    }
    if (kind === 'background') {
      return `chapters/${owner}/background.${extension}`;
    }
    return `archives/${owner}/${kind === 'image' ? 'images' : 'sprites'}/${node}.${extension}`;
  }

  public mediaPath(assetId: string, file: File): string {
    return mediaObjectPath(assetId, file.type);
  }

  public toPublicUrl(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }
    const mediaId = MEDIA_REFERENCE_PATTERN.exec(value.trim())?.[1];
    if (mediaId) {
      return this.mediaUrls.get(mediaReference(mediaId)) ?? value;
    }
    const path = this.toStoragePath(value);
    return path
      ? this.supabase.storage.from(ARCHIVE_ASSET_BUCKET).getPublicUrl(path).data.publicUrl
      : value;
  }

  public toStoredValue(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }
    const source = value.trim();
    const mediaId = MEDIA_REFERENCE_PATTERN.exec(source)?.[1];
    return mediaId
      ? mediaReference(mediaId)
      : (this.mediaReferencesByUrl.get(source) ?? this.toStoragePath(source) ?? source);
  }

  public toLegacyStoragePath(value?: string | null): string | undefined {
    const stored = this.toStoredValue(value);
    const path = this.toStoragePath(stored);
    return path && STORAGE_PATH_PATTERN.test(path) ? path : undefined;
  }

  public mediaReferences(nodes: DialogueNode[]): string[] {
    const values: string[] = [];
    const collect = (items: DialogueNode[]) => {
      for (const node of items) {
        if (node.type === 'line' && node.sprite) {
          values.push(node.sprite);
        } else if (node.type === 'choice') {
          node.options.forEach((option) => collect(option.nodes));
        } else if (node.type === 'image') {
          values.push(node.src);
        }
      }
    };
    collect(nodes);
    return values;
  }

  public async listMediaFolders(): Promise<MediaFolder[]> {
    const { data, error } = await this.supabase
      .from('media_folders')
      .select('id,name')
      .order('name', { ascending: true });
    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => this.mediaFolderFromRow(row as MediaFolderRow));
  }

  public async createMediaFolder(name: string): Promise<MediaFolder> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Folder name is required.');
    }
    const { data, error } = await this.supabase
      .from('media_folders')
      .insert({ name: trimmed })
      .select('id,name')
      .single();
    if (error) {
      throw error;
    }
    return this.mediaFolderFromRow(data as MediaFolderRow);
  }

  public async renameMediaFolder(folderId: string, name: string): Promise<MediaFolder> {
    const trimmed = name.trim();
    if (!UUID_PATTERN.test(folderId) || !trimmed) {
      throw new Error('Folder name is required.');
    }
    const { data, error } = await this.supabase
      .from('media_folders')
      .update({ name: trimmed })
      .eq('id', folderId.toLowerCase())
      .select('id,name')
      .single();
    if (error) {
      throw error;
    }
    return this.mediaFolderFromRow(data as MediaFolderRow);
  }

  public async removeMediaFolder(folderId: string): Promise<void> {
    if (!UUID_PATTERN.test(folderId)) {
      throw new Error('Invalid media folder ID.');
    }
    const { error } = await this.supabase
      .from('media_folders')
      .delete()
      .eq('id', folderId.toLowerCase());
    if (error) {
      throw error;
    }
  }

  public async moveMediaAsset(assetId: string, folderId: string | null): Promise<MediaAsset> {
    if (!UUID_PATTERN.test(assetId) || (folderId !== null && !UUID_PATTERN.test(folderId))) {
      throw new Error('Invalid media folder reference.');
    }
    const { data, error } = await this.supabase
      .from('media_assets')
      .update({ folder_id: folderId?.toLowerCase() ?? null })
      .eq('id', assetId.toLowerCase())
      .select(
        'id,display_name,object_key,provider,mime_type,byte_size,folder_id,original_url,attribution',
      )
      .single();
    if (error) {
      throw error;
    }
    const asset = this.mediaAssetFromRow(data as MediaAssetRow);
    this.rememberMediaAsset(asset);
    return asset;
  }

  public async listMediaAssets(
    search = '',
    limit = 100,
    offset = 0,
    folderId?: string | null,
  ): Promise<{ assets: MediaAsset[]; total: number }> {
    let query = this.supabase
      .from('media_assets')
      .select(
        'id,display_name,object_key,provider,mime_type,byte_size,folder_id,original_url,attribution',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (search.trim()) {
      query = query.ilike('display_name', `%${search.trim()}%`);
    }
    if (folderId === null) {
      query = query.is('folder_id', null);
    } else if (folderId) {
      query = query.eq('folder_id', folderId);
    }
    const { data, count, error } = await query;
    if (error) {
      throw error;
    }
    const assets = (data ?? []).map((row) => this.mediaAssetFromRow(row as MediaAssetRow));
    assets.forEach((asset) => this.rememberMediaAsset(asset));
    return { assets, total: count ?? 0 };
  }

  public async importRemoteMediaReferences(
    nodes: DialogueNode[],
  ): Promise<{ nodes: DialogueNode[]; unresolved: number }> {
    const imported = new Map<string, Promise<string | undefined>>();
    const unresolved = new Set<string>();
    const resolve = (value?: string): Promise<string | undefined> => {
      const source = value?.trim();
      if (!source || isMediaReference(source)) {
        return Promise.resolve(source || undefined);
      }
      if (!isRemoteImageUrl(source)) {
        return Promise.resolve(source);
      }
      const existing = imported.get(source);
      if (existing) {
        return existing;
      }
      const pending = this.importMediaUrl(source)
        .then((asset) => mediaReference(asset.id))
        .catch(() => {
          unresolved.add(source);
          return undefined;
        });
      imported.set(source, pending);
      return pending;
    };
    const spriteReferences = new Map<string, Promise<string | undefined>>();
    let folderIds: Map<string, string> | undefined;
    const resolveSprite = async (value?: string): Promise<string> => {
      const source = value?.trim() ?? '';
      if (!source) {
        return '';
      }
      if (isMediaReference(source) || isRemoteImageUrl(source)) {
        return (await resolve(source)) ?? '';
      }
      const existing = spriteReferences.get(source);
      if (existing) {
        return (await existing) ?? '';
      }
      const pending = (async () => {
        folderIds ??= new Map(
          (await this.listMediaFolders()).map((folder) => [
            folder.name.trim().toLowerCase(),
            folder.id,
          ]),
        );
        return this.findMediaReference(source, folderIds);
      })();
      spriteReferences.set(source, pending);
      const reference = await pending;
      if (!reference) {
        unresolved.add(source);
      }
      return reference ?? '';
    };
    const transform = async (items: DialogueNode[]): Promise<DialogueNode[]> =>
      Promise.all(
        items.map(async (node) => {
          if (node.type === 'line') {
            return { ...node, sprite: await resolveSprite(node.sprite) };
          }
          if (node.type === 'choice') {
            return {
              ...node,
              options: await Promise.all(
                node.options.map(async (option) => ({
                  ...option,
                  nodes: await transform(option.nodes),
                })),
              ),
            };
          }
          return { ...node, src: (await resolve(node.src)) ?? '' };
        }),
      );
    return { nodes: await transform(nodes), unresolved: unresolved.size };
  }

  private async findMediaReference(
    value: string,
    folders: Map<string, string>,
  ): Promise<string | undefined> {
    const segments = value
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (segments.length > 2 || !segments.length) {
      return undefined;
    }
    const fileName = segments.at(-1) ?? '';
    const folderName = segments.length === 2 ? segments[0] : undefined;
    const normalizedFileName = fileName.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
    const folderId = folderName ? folders.get(folderName.toLowerCase()) : undefined;
    if (folderName && !folderId) {
      return undefined;
    }
    let query = this.supabase
      .from('media_assets')
      .select(
        'id,display_name,object_key,provider,mime_type,byte_size,folder_id,original_url,attribution',
      )
      .limit(1000);
    query = folderId ? query.eq('folder_id', folderId) : query.is('folder_id', null);
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    const asset = ((data as MediaAssetRow[] | null) ?? []).find(
      (row) =>
        row.display_name
          .replace(/\.[a-z0-9]+$/i, '')
          .trim()
          .toLowerCase() === normalizedFileName,
    );
    if (!asset) {
      return undefined;
    }
    const media = this.mediaAssetFromRow(asset);
    this.rememberMediaAsset(media);
    return mediaReference(media.id);
  }

  public async resolveMediaReferences(values: Iterable<string | null | undefined>): Promise<void> {
    const ids = [
      ...new Set(
        Array.from(values, (value) =>
          MEDIA_REFERENCE_PATTERN.exec(value?.trim() ?? '')?.[1]?.toLowerCase(),
        ).filter((id): id is string => !!id),
      ),
    ];
    for (let offset = 0; offset < ids.length; offset += 100) {
      const { data, error } = await this.supabase
        .from('media_assets')
        .select('id,provider,object_key')
        .in('id', ids.slice(offset, offset + 100));
      if (error) throw error;
      for (const id of ids.slice(offset, offset + 100)) {
        this.mediaUrls.delete(mediaReference(id));
      }
      for (const rawAsset of (data ?? []) as MediaAssetRow[]) {
        const asset = this.mediaAssetFromRow(rawAsset);
        this.rememberMediaAsset(asset);
        const reference = mediaReference(asset.id);
        let url: string | undefined;
        if (asset.provider === 'supabase' && isStoragePath(asset.objectKey)) {
          url = this.supabase.storage.from(ARCHIVE_ASSET_BUCKET).getPublicUrl(asset.objectKey)
            .data.publicUrl;
        } else if (
          asset.provider === 'r2' &&
          MEDIA_OBJECT_PATH_PATTERN.test(asset.objectKey) &&
          environment.r2PublicUrl
        ) {
          url = new URL(
            asset.objectKey,
            `${environment.r2PublicUrl.replace(/\/$/, '')}/`,
          ).toString();
        }
        if (url) {
          this.mediaUrls.set(reference, url);
          this.mediaReferencesByUrl.set(url, reference);
        }
      }
    }
  }

  public toStoragePath(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }
    const source = value.trim();
    if (isStoragePath(source)) {
      return source;
    }
    try {
      const url = new URL(source);
      const marker = `/storage/v1/object/public/${ARCHIVE_ASSET_BUCKET}/`;
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex < 0) {
        return undefined;
      }
      const path = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
      return isStoragePath(path) ? path : undefined;
    } catch {
      return undefined;
    }
  }

  public toStorageNodes(nodes: DialogueNode[]): DialogueNode[] {
    return nodes.map((node) =>
      node.type === 'line'
        ? { ...node, sprite: this.toStoredValue(node.sprite) }
        : node.type === 'choice'
          ? {
              ...node,
              options: node.options.map((option) => ({
                ...option,
                nodes: this.toStorageNodes(option.nodes),
              })),
            }
          : { ...node, src: this.toStoredValue(node.src) ?? node.src },
    );
  }

  public toPublicNodes(nodes: DialogueNode[]): DialogueNode[] {
    return nodes.map((node) =>
      node.type === 'line'
        ? { ...node, sprite: this.toPublicUrl(node.sprite) }
        : node.type === 'choice'
          ? {
              ...node,
              options: node.options.map((option) => ({
                ...option,
                nodes: this.toPublicNodes(option.nodes),
              })),
            }
          : { ...node, src: this.toPublicUrl(node.src) ?? node.src },
    );
  }

  public collectPaths(nodes: DialogueNode[]): string[] {
    const paths: string[] = [];
    const collect = (items: DialogueNode[]) => {
      items.forEach((node) => {
        if (node.type === 'line') {
          const path = this.toStoragePath(node.sprite);
          if (path && !MEDIA_OBJECT_PATH_PATTERN.test(path)) paths.push(path);
        } else if (node.type === 'choice') {
          node.options.forEach((option) => collect(option.nodes));
        } else {
          const path = this.toStoragePath(node.src);
          if (path && !MEDIA_OBJECT_PATH_PATTERN.test(path)) paths.push(path);
        }
      });
    };
    collect(nodes);
    return paths;
  }

  public async removePaths(paths: string[]): Promise<void> {
    await this.removeObjectKeys(paths.filter((path) => STORAGE_PATH_PATTERN.test(path)));
  }

  public async removeOwnerAssets(prefix: string): Promise<void> {
    const paths = await this.listPaths(prefix);
    await this.removePaths(paths);
  }

  private async removeObjectKeys(paths: string[]): Promise<void> {
    const uniquePaths = [...new Set(paths.filter(isStoragePath))];
    if (!uniquePaths.length) {
      return;
    }
    const { error } = await this.supabase.storage.from(ARCHIVE_ASSET_BUCKET).remove(uniquePaths);
    if (error) {
      throw error;
    }
  }

  private mediaFolderFromRow(row: MediaFolderRow): MediaFolder {
    return { id: row.id, name: row.name };
  }

  private mediaAssetFromRow(row: MediaAssetRow): MediaAsset {
    return {
      id: row.id,
      displayName: row.display_name,
      objectKey: row.object_key,
      provider: row.provider,
      mimeType: row.mime_type,
      byteSize: row.byte_size,
      folderId: row.folder_id ?? undefined,
      originalUrl: row.original_url ?? undefined,
      attribution: row.attribution ?? undefined,
    };
  }

  private rememberMediaAsset(asset: MediaAsset): void {
    const reference = mediaReference(asset.id);
    this.mediaAssets.set(reference, asset);
    const url = this.mediaAssetUrl(asset);
    if (url) {
      this.mediaUrls.set(reference, url);
      this.mediaReferencesByUrl.set(url, reference);
    }
  }

  private usesR2(): boolean {
    return environment.mediaProvider === 'r2';
  }

  private async r2Request<T>(path: string, init: RequestInit): Promise<T> {
    if (!environment.r2ApiUrl) {
      throw new Error('R2 media API is not configured.');
    }
    const { data, error } = await this.supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error('Sign in as an administrator to manage media.');
    }
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${data.session.access_token}`);
    const response = await fetch(
      new URL(path.replace(/^\//, ''), `${environment.r2ApiUrl.replace(/\/$/, '')}/`),
      { ...init, headers },
    );
    const body = (await response.json().catch(() => undefined)) as
      (T & { error?: string }) | undefined;
    if (!response.ok) {
      throw new Error(body?.error || 'The media operation failed.');
    }
    return body as T;
  }

  private mediaAssetUrl(asset: MediaAsset): string | undefined {
    if (asset.provider === 'supabase' && isStoragePath(asset.objectKey)) {
      return this.supabase.storage.from(ARCHIVE_ASSET_BUCKET).getPublicUrl(asset.objectKey).data
        .publicUrl;
    }
    if (
      asset.provider === 'r2' &&
      MEDIA_OBJECT_PATH_PATTERN.test(asset.objectKey) &&
      environment.r2PublicUrl
    ) {
      return new URL(asset.objectKey, `${environment.r2PublicUrl.replace(/\/$/, '')}/`).toString();
    }
    return undefined;
  }

  private async listPaths(prefix: string): Promise<string[]> {
    const { data, error } = await this.supabase.storage.from(ARCHIVE_ASSET_BUCKET).list(prefix, {
      limit: 1000,
    });
    if (error) {
      throw error;
    }
    const paths: string[] = [];
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      if (item.id) {
        paths.push(path);
      } else {
        paths.push(...(await this.listPaths(path)));
      }
    }
    return paths;
  }

  private async validateImage(file: File): Promise<void> {
    if (!file.size) {
      throw new Error('Choose a non-empty image file.');
    }
    if (!IMAGE_EXTENSIONS[file.type]) {
      throw new Error('Choose a PNG, JPEG, GIF, WebP, or AVIF image.');
    }
    if (file.size > ARCHIVE_ASSET_MAX_BYTES) {
      throw new Error('Images must be 10 MB or smaller.');
    }
    const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const valid =
      file.type === 'image/png'
        ? signature.length >= 8 &&
          signature[0] === 0x89 &&
          signature[1] === 0x50 &&
          signature[2] === 0x4e &&
          signature[3] === 0x47 &&
          signature[4] === 0x0d &&
          signature[5] === 0x0a &&
          signature[6] === 0x1a &&
          signature[7] === 0x0a
        : file.type === 'image/jpeg'
          ? signature.length >= 3 &&
            signature[0] === 0xff &&
            signature[1] === 0xd8 &&
            signature[2] === 0xff
          : file.type === 'image/gif'
            ? new TextDecoder().decode(signature.slice(0, 6)) === 'GIF87a' ||
              new TextDecoder().decode(signature.slice(0, 6)) === 'GIF89a'
            : file.type === 'image/webp'
              ? new TextDecoder().decode(signature.slice(0, 4)) === 'RIFF' &&
                new TextDecoder().decode(signature.slice(8, 12)) === 'WEBP'
              : file.type === 'image/avif'
                ? new TextDecoder().decode(signature.slice(4, 8)) === 'ftyp' &&
                  ['avif', 'avis'].includes(new TextDecoder().decode(signature.slice(8, 12)))
                : false;
    if (!valid) {
      throw new Error('The selected file is not a valid image.');
    }
  }

  private safePath(value: string): string {
    const segments = value.split('/').map((segment) => this.safeSegment(segment));
    if (!segments.length) {
      throw new Error('Invalid archive image owner.');
    }
    return segments.join('/');
  }

  private safeSegment(value: string): string {
    const segment = value.trim().replace(/[^A-Za-z0-9_-]/g, '-');
    if (!segment || segment === '.' || segment === '..') {
      throw new Error('Invalid archive image owner.');
    }
    return segment;
  }
}
