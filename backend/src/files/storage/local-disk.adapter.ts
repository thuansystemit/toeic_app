import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { extname, join, basename } from 'path';
import {
  FileStorageAdapter,
  ReadableFile,
  StoredFile,
} from './file-storage.adapter';

@Injectable()
export class LocalDiskAdapter implements FileStorageAdapter {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root =
      config.get<string>('uploadsDir') ?? join(process.cwd(), 'uploads');
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
  }

  async save(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }): Promise<StoredFile> {
    await this.ensureDir();
    // Opaque, unguessable key; keep the original extension for content sniffing.
    const ext = extname(file.originalname).toLowerCase().slice(0, 10);
    const storageKey = `${randomUUID()}${ext}`;
    await fs.writeFile(join(this.root, storageKey), file.buffer);
    return {
      storageKey,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    };
  }

  async read(storageKey: string): Promise<ReadableFile> {
    // Guard against path traversal: only a bare filename is ever valid.
    const safe = basename(storageKey);
    const path = join(this.root, safe);
    let size: number;
    try {
      const stat = await fs.stat(path);
      size = stat.size;
    } catch {
      throw new NotFoundException('File not found');
    }
    return {
      stream: createReadStream(path),
      mimeType: this.guessMime(safe),
      sizeBytes: size,
    };
  }

  private guessMime(name: string): string {
    const ext = extname(name).toLowerCase();
    const map: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}
