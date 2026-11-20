import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../app.module.js';
import { sha256Hex, uuidv7 } from '../../common/crypto.js';
import { detectImageType } from '../../common/files/image-signature.js';
import { DomainException } from '../../common/http/problem-details.js';
import { Semaphore } from '../../common/semaphore.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../../storage/object-storage.js';
import { type AuditActor, AuditService } from '../audit/audit.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { ImageRejectedError, processImage } from './image-processing.js';
import {
  adminMediaSelect,
  objectKeys,
  type StoredVariant,
  toAdminMediaDto,
  usageCount,
} from './media.mapper.js';
import type { ListMediaQuery } from './media.schemas.js';

const WEBP = 'image/webp';

/** Image processing is CPU- and memory-heavy: a few at a time per instance, the rest queue. */
const processing = new Semaphore(2);

const usedWhere: Prisma.MediaWhereInput = {
  OR: [
    { productMedia: { some: {} } },
    { categoryImages: { some: {} } },
    { categoryBanners: { some: {} } },
    { brandLogos: { some: {} } },
    { collectionImages: { some: {} } },
  ],
};

const notFound = () =>
  new DomainException(HttpStatus.NOT_FOUND, 'MEDIA_NOT_FOUND', 'Image not found.');

/**
 * Public image library (products, categories, brands, collections, banners). Uploads are
 * verified by their magic bytes, re-encoded without metadata, stored with responsive copies under
 * immutable keys, and de-duplicated by checksum. Private files (payment screenshots) never
 * appear here.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger('Media');
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.baseUrl = config.get('MEDIA_PUBLIC_BASE_URL', { infer: true });
  }

  async upload(
    file: { buffer: Buffer; size: number } | undefined,
    fields: { alt?: string | undefined },
    actor: AuditActor,
  ) {
    if (!file?.size) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'FILE_REQUIRED', 'Choose an image.');
    }
    if (!detectImageType(file.buffer)) {
      throw new DomainException(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'UNSUPPORTED_FILE_TYPE',
        'Images must be JPG, PNG or WEBP.',
      );
    }

    const checksum = sha256Hex(file.buffer);
    const existing = await this.prisma.media.findFirst({
      where: { checksumSha256: checksum, visibility: 'PUBLIC' },
      select: adminMediaSelect,
    });
    if (existing) return { created: false, media: toAdminMediaDto(this.baseUrl, existing) };

    const image = await processing.run(async () => {
      try {
        return await processImage(file.buffer);
      } catch (error) {
        if (error instanceof ImageRejectedError) {
          throw new DomainException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'IMAGE_REJECTED',
            error.message,
          );
        }
        throw error;
      }
    });

    const id = uuidv7(); // the row id too: keys and rows match, ids stay time-ordered
    const fullKey = `media/${id}/full.webp`;
    const variants: StoredVariant[] = image.variants.map((v) => ({
      width: v.width,
      height: v.height,
      key: `media/${id}/w${String(v.width)}.webp`,
    }));
    const uploads = [
      { key: fullKey, body: image.full.body },
      ...image.variants.map((v, i) => ({ key: variants[i]?.key ?? '', body: v.body })),
    ];
    const keys = uploads.map((u) => u.key);
    try {
      await Promise.all(uploads.map((u) => this.storage.putPublic({ ...u, contentType: WEBP })));
    } catch (error) {
      await this.discard(keys);
      this.logger.error('Image upload failed', error instanceof Error ? error.stack : undefined);
      throw new DomainException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'UPLOAD_FAILED',
        'We could not save the image. Please try again.',
      );
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.media.create({
          data: {
            id,
            storageKey: fullKey,
            visibility: 'PUBLIC',
            mimeType: WEBP,
            sizeBytes: image.full.body.length,
            width: image.full.width,
            height: image.full.height,
            alt: fields.alt ?? null,
            variants,
            checksumSha256: checksum,
            uploadedByStaffId: actor.staffId,
          },
          select: adminMediaSelect,
        });
        await this.audit.record(
          actor,
          {
            action: 'media.upload',
            entityType: 'media',
            entityId: created.id,
            changes: { bytes: file.size, width: created.width, height: created.height },
          },
          tx,
        );
        return created;
      });
      return { created: true, media: toAdminMediaDto(this.baseUrl, row) };
    } catch (error) {
      await this.discard(keys);
      throw error;
    }
  }

  async list(query: ListMediaQuery) {
    const where: Prisma.MediaWhereInput = {
      visibility: 'PUBLIC',
      id: query.before ? { lt: query.before } : undefined,
      alt: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
      ...(query.unused ? { NOT: usedWhere } : {}),
    };
    const rows = await this.prisma.media.findMany({
      where,
      orderBy: { id: 'desc' }, // UUIDv7: newest first
      take: query.limit + 1,
      select: adminMediaSelect,
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map((row) => toAdminMediaDto(this.baseUrl, row)),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async get(id: string) {
    return toAdminMediaDto(this.baseUrl, await this.find(id));
  }

  async update(id: string, input: { alt: string | null | undefined }, actor: AuditActor) {
    const before = await this.find(id);
    const alt = input.alt ?? null;
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.media.update({
        where: { id },
        data: { alt },
        select: adminMediaSelect,
      });
      await this.audit.record(
        actor,
        {
          action: 'media.update',
          entityType: 'media',
          entityId: id,
          changes: { before: { alt: before.alt }, after: { alt } },
        },
        tx,
      );
      return updated;
    });
    // Alt text is part of product and category responses.
    if (usageCount(before) > 0) await this.catalog.invalidate();
    return toAdminMediaDto(this.baseUrl, row);
  }

  async remove(id: string, actor: AuditActor): Promise<void> {
    const keys = await this.prisma.$transaction(async (tx) => {
      // Lock the row first: nothing can attach the image while it is being deleted.
      const locked = await tx.$executeRaw`
        SELECT 1 FROM media WHERE id = ${id}::uuid AND visibility = 'PUBLIC' FOR UPDATE`;
      if (!locked) throw notFound();
      const row = await tx.media.findUniqueOrThrow({ where: { id }, select: adminMediaSelect });
      if (usageCount(row) > 0) {
        throw new DomainException(
          HttpStatus.CONFLICT,
          'MEDIA_IN_USE',
          'This image is still used. Remove it from those places first.',
          { extensions: { usage: toAdminMediaDto(this.baseUrl, row).usage } },
        );
      }
      await tx.media.delete({ where: { id } });
      await this.audit.record(
        actor,
        { action: 'media.delete', entityType: 'media', entityId: id },
        tx,
      );
      return objectKeys(row);
    });
    await this.discard(keys);
  }

  private async find(id: string) {
    const row = await this.prisma.media.findFirst({
      where: { id, visibility: 'PUBLIC' },
      select: adminMediaSelect,
    });
    if (!row) throw notFound();
    return row;
  }

  /** Best effort: a leftover object is harmless (unreferenced, unguessable key). */
  private async discard(keys: string[]) {
    await this.storage.deletePublic(keys).catch((error: unknown) => {
      this.logger.warn(
        `Could not delete ${String(keys.length)} stored object(s): ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }
}
