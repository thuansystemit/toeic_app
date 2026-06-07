import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { FILE_STORAGE } from './storage/file-storage.adapter';
import { LocalDiskAdapter } from './storage/local-disk.adapter';

@Module({
  providers: [
    FilesService,
    LocalDiskAdapter,
    { provide: FILE_STORAGE, useExisting: LocalDiskAdapter },
  ],
  controllers: [FilesController],
  exports: [FilesService],
})
export class FilesModule {}
