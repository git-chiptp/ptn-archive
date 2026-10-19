import { Injectable, inject, signal } from '@angular/core';
import { DialogueNode } from '../models/transcript.models';
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

const STORAGE_PATH_PATTERN = /^(?:chapters|archives)\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.[A-Za-z0-9]+$/;
const RASTER_DATA_URL_PATTERN = /^data:image\/(?:avif|gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i;

export function isAllowedImageSource(value: string): boolean {
  const source = value.trim();
  try {
    const url = new URL(source);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return STORAGE_PATH_PATTERN.test(source);
  }
}

export function isRenderableImageSource(value: string): boolean {
  return isAllowedImageSource(value) || RASTER_DATA_URL_PATTERN.test(value.trim());
}

@Injectable({ providedIn: 'root' })
export class ArchiveStorageService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  public readonly pendingUploads = signal(0);

  public async replaceImage(file: File, _previousValue: string | undefined, path: string): Promise<string> {
    return this.uploadImage(file, path);
  }

  public async uploadImage(file: File, path: string): Promise<string> {
    this.validateImage(file);
    if (!STORAGE_PATH_PATTERN.test(path)) {
      throw new Error('Invalid archive image path.');
    }
    this.pendingUploads.update((count) => count + 1);
    try {
      const { error } = await this.supabase.storage.from(ARCHIVE_ASSET_BUCKET).upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: true,
      });
      if (error) {
        throw error;
      }
      return path;
    } finally {
      this.pendingUploads.update((count) => Math.max(0, count - 1));
    }
  }

  public imagePath(ownerId: string, kind: 'background' | 'image' | 'sprite', nodeId: string, file: File): string {
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

  public toPublicUrl(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }
    const path = this.toStoragePath(value);
    return path
      ? this.supabase.storage.from(ARCHIVE_ASSET_BUCKET).getPublicUrl(path).data.publicUrl
      : value;
  }

  public toStoragePath(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }
    const source = value.trim();
    if (STORAGE_PATH_PATTERN.test(source)) {
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
      return STORAGE_PATH_PATTERN.test(path) ? path : undefined;
    } catch {
      return undefined;
    }
  }

  public toStorageNodes(nodes: DialogueNode[]): DialogueNode[] {
    return nodes.map((node) =>
      node.type === 'line'
        ? { ...node, sprite: this.toStoragePath(node.sprite) ?? node.sprite }
        : node.type === 'choice'
          ? {
              ...node,
              options: node.options.map((option) => ({
                ...option,
                nodes: this.toStorageNodes(option.nodes),
              })),
            }
          : { ...node, src: this.toStoragePath(node.src) ?? node.src },
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
          if (path) paths.push(path);
        } else if (node.type === 'choice') {
          node.options.forEach((option) => collect(option.nodes));
        } else {
          const path = this.toStoragePath(node.src);
          if (path) paths.push(path);
        }
      });
    };
    collect(nodes);
    return paths;
  }

  public async removePaths(paths: string[]): Promise<void> {
    const uniquePaths = [...new Set(paths.filter((path) => STORAGE_PATH_PATTERN.test(path)))];
    if (!uniquePaths.length) {
      return;
    }
    const { error } = await this.supabase.storage.from(ARCHIVE_ASSET_BUCKET).remove(uniquePaths);
    if (error) {
      throw error;
    }
  }

  public async removeOwnerAssets(prefix: string): Promise<void> {
    const paths = await this.listPaths(prefix);
    await this.removePaths(paths);
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
        paths.push(...await this.listPaths(path));
      }
    }
    return paths;
  }

  private validateImage(file: File) {
    if (!IMAGE_EXTENSIONS[file.type]) {
      throw new Error('Choose a PNG, JPEG, GIF, WebP, or AVIF image.');
    }
    if (file.size > ARCHIVE_ASSET_MAX_BYTES) {
      throw new Error('Images must be 10 MB or smaller.');
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
