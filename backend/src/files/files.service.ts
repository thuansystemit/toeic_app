import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  FILE_STORAGE,
  FileStorageAdapter,
  ReadableFile,
  StoredFile,
} from './storage/file-storage.adapter';

const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20 MB (REQ-013)
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; //  5 MB (REQ-013)

const AUDIO_MIME = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/ogg'];
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export type UploadKind = 'audio' | 'image';

@Injectable()
export class FilesService {
  constructor(
    @Inject(FILE_STORAGE) private readonly storage: FileStorageAdapter,
  ) {}

  async upload(
    kind: UploadKind,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    } | undefined,
  ): Promise<StoredFile> {
    if (!file) throw new BadRequestException('No file provided');

    const allowed = kind === 'audio' ? AUDIO_MIME : IMAGE_MIME;
    const limit = kind === 'audio' ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;

    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported ${kind} type: ${file.mimetype}`,
      );
    }
    if (file.size > limit) {
      throw new BadRequestException(
        `${kind} exceeds ${Math.round(limit / 1024 / 1024)}MB limit`,
      );
    }
    return this.storage.save(file);
  }

  /** Store a document (PDF/DOCX) — used by the exam-file extraction feature.
   *  Validation is done by the caller; this just persists via the storage adapter. */
  async saveDocument(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }): Promise<StoredFile> {
    return this.storage.save(file);
  }

  read(storageKey: string): Promise<ReadableFile> {
    return this.storage.read(storageKey);
  }
}
