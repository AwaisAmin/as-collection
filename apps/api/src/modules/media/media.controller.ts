import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, type NodeResponse } from '@nestjs/platform-node';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import type { AuditActor } from '../audit/audit.service.js';
import { Actor, Staff } from '../staff/staff-auth.guard.js';
import {
  type ListMediaQuery,
  listMediaQuerySchema,
  MAX_UPLOAD_BYTES,
  updateMediaSchema,
  uploadFieldsSchema,
} from './media.schemas.js';
import { MediaService } from './media.service.js';

const idParam = { schema: z.uuid() };

@ApiTags('Admin · Media')
@Controller('admin/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @Staff('catalog.read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Image library, newest first (`unused=1` for clean-up)' })
  list(@Query({ schema: listMediaQuerySchema }) query: ListMediaQuery) {
    return this.media.list(query);
  }

  @Get(':id')
  @Staff('catalog.read')
  @Header('Cache-Control', 'no-store')
  get(@Param('id', idParam) id: string) {
    return this.media.get(id);
  }

  @Post()
  @Staff('media.write')
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 2, parts: 3, fieldSize: 2048 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload an image (JPG, PNG or WEBP, max 20 MB)',
    description:
      'multipart/form-data: `file`, optional `alt`. Stored as WebP without metadata, with ' +
      'responsive copies. Uploading the same file again returns the existing image (200).',
  })
  async upload(
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @Body({ schema: uploadFieldsSchema }) fields: z.infer<typeof uploadFieldsSchema>,
    @Actor() actor: AuditActor,
    @Res({ passthrough: true }) res: NodeResponse,
  ) {
    const result = await this.media.upload(file, fields, actor);
    res.statusCode = result.created ? HttpStatus.CREATED : HttpStatus.OK;
    return result.media;
  }

  @Patch(':id')
  @Staff('media.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Edit the alt text' })
  update(
    @Param('id', idParam) id: string,
    @Body({ schema: updateMediaSchema }) body: z.infer<typeof updateMediaSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.media.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('media.write')
  @ApiOperation({ summary: 'Delete an unused image (409 MEDIA_IN_USE otherwise)' })
  async remove(@Param('id', idParam) id: string, @Actor() actor: AuditActor): Promise<void> {
    await this.media.remove(id, actor);
  }
}
