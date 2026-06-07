export interface StoredFile {
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
}

export interface ReadableFile {
  stream: NodeJS.ReadableStream;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Storage abstraction (ADR-006 / I-002). The MVP ships a local-disk adapter;
 * an S3 adapter can be dropped in later without touching callers.
 */
export interface FileStorageAdapter {
  save(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }): Promise<StoredFile>;

  read(storageKey: string): Promise<ReadableFile>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
