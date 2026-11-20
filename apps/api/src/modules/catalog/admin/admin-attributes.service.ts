import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { z } from 'zod';

import type { AppConfig } from '../../../app.module.js';
import {
  assertFresh,
  checkImages,
  conflict,
  freeSlug,
  lockRow,
  notFound,
  type Tx,
} from '../../../common/admin-write.js';
import { ValidationFailedException } from '../../../common/http/problem-details.js';
import { isUniqueViolation } from '../../../common/prisma-errors.js';
import { slugify, uniqueSlug } from '../../../common/slug.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { type AuditActor, AuditService, diff } from '../../audit/audit.service.js';
import { mediaUrl } from '../catalog.mapper.js';
import { CatalogService } from '../catalog.service.js';
import type {
  AttributeValueInput,
  CreateAttributeInput,
  createBrandSchema,
  UpdateAttributeInput,
  updateAttributeValueSchema,
  updateBrandSchema,
} from './taxonomy.schemas.js';

const attributeNotFound = () => notFound('ATTRIBUTE_NOT_FOUND', 'Attribute not found.');
const valueNotFound = () => notFound('VALUE_NOT_FOUND', 'Attribute value not found.');
const CHOICE = new Set(['SELECT', 'MULTI_SELECT']);

const attributeSelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  scope: true,
  isFilterable: true,
  isVisible: true,
  unit: true,
  position: true,
  updatedAt: true,
  values: {
    orderBy: [{ position: 'asc' }, { label: 'asc' }],
    select: {
      id: true,
      value: true,
      label: true,
      swatch: true,
      position: true,
      _count: { select: { productValues: true, variantValues: true } },
    },
  },
  _count: { select: { productValues: true, variantValues: true, categories: true } },
} satisfies Prisma.AttributeSelect;

type AttributeRow = Prisma.AttributeGetPayload<{ select: typeof attributeSelect }>;

const toAttributeDto = (row: AttributeRow) => ({
  id: row.id,
  /** Filter parameter: `?f.<code>=<value>`. */
  code: row.code,
  name: row.name,
  type: row.type,
  scope: row.scope,
  isFilterable: row.isFilterable,
  isVisible: row.isVisible,
  unit: row.unit,
  position: row.position,
  values: row.values.map((v) => ({
    id: v.id,
    value: v.value,
    label: v.label,
    swatch: v.swatch,
    position: v.position,
    usage: v._count.productValues + v._count.variantValues,
  })),
  usage: {
    products: row._count.productValues,
    variants: row._count.variantValues,
    categories: row._count.categories,
  },
  updatedAt: row.updatedAt,
});

/** Value slugs from labels, unique within the attribute (`red`, `red-2`). */
function valueSlugs(inputs: AttributeValueInput[], taken: Set<string>) {
  return inputs.map((v, i) => {
    const value = v.value ?? uniqueSlug(slugify(v.label, 76) || 'value', taken, 80);
    if (taken.has(value)) {
      throw new ValidationFailedException([
        { path: `values.${String(i)}.value`, message: `"${value}" is already a value.` },
      ]);
    }
    taken.add(value);
    return value;
  });
}

/**
 * Attributes (the filters and variant options of the catalog) and their values, plus brands.
 * Codes and value slugs appear in storefront filter URLs, so they never change once created;
 * an attribute's type or scope can change only while nothing uses it.
 */
@Injectable()
export class AdminAttributesService {
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.baseUrl = config.get('MEDIA_PUBLIC_BASE_URL', { infer: true });
  }

  // ─── Attributes ───

  async list() {
    const rows = await this.prisma.attribute.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: attributeSelect,
    });
    return rows.map(toAttributeDto);
  }

  async get(id: string) {
    const row = await this.prisma.attribute.findUnique({ where: { id }, select: attributeSelect });
    if (!row) throw attributeNotFound();
    return toAttributeDto(row);
  }

  async create(input: CreateAttributeInput, actor: AuditActor) {
    const id = await this.write(async (tx) => {
      const code =
        input.code ??
        (await freeSlug(
          input.name,
          'attribute',
          async (base) =>
            (
              await tx.attribute.findMany({
                where: { code: { startsWith: base } },
                select: { code: true },
              })
            ).map((a) => ({ slug: a.code })),
          60,
        ));
      if (
        input.code &&
        (await tx.attribute.findUnique({ where: { code }, select: { id: true } }))
      ) {
        throw codeTaken();
      }
      const values = valueSlugs(input.values, new Set());
      const last = await tx.attribute.aggregate({ _max: { position: true } });
      const created = await tx.attribute.create({
        data: {
          code,
          name: input.name,
          type: input.type,
          scope: input.scope,
          isFilterable: input.isFilterable,
          isVisible: input.isVisible,
          unit: input.unit ?? null,
          position: input.position ?? (last._max.position ?? -1) + 1,
          values: {
            createMany: {
              data: input.values.map((v, i) => ({
                value: values[i] ?? '',
                label: v.label,
                swatch: v.swatch ?? null,
                position: v.position ?? i,
              })),
            },
          },
        },
        select: { id: true },
      });
      await this.audit.record(
        actor,
        {
          action: 'attribute.create',
          entityType: 'attribute',
          entityId: created.id,
          changes: { code, name: input.name, type: input.type, scope: input.scope, values },
        },
        tx,
      );
      return created.id;
    });
    return this.get(id);
  }

  async update(id: string, input: UpdateAttributeInput, actor: AuditActor) {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'attributes', id))) throw attributeNotFound();
      const before = await tx.attribute.findUniqueOrThrow({
        where: { id },
        include: { _count: { select: { productValues: true, variantValues: true, values: true } } },
      });
      assertFresh(before.updatedAt, input.updatedAt, 'attribute');
      const type = input.type ?? before.type;
      const scope = input.scope ?? before.scope;
      if (type !== before.type || scope !== before.scope) {
        const used = before._count.productValues + before._count.variantValues;
        if (used > 0) {
          throw conflict(
            'ATTRIBUTE_IN_USE',
            `Its type or scope cannot change while ${String(used)} product value(s) use it.`,
          );
        }
        if (scope === 'VARIANT' && type !== 'SELECT') {
          throw new ValidationFailedException([
            { path: 'type', message: 'Variant options must be single-choice (SELECT).' },
          ]);
        }
        if (!CHOICE.has(type) && before._count.values > 0) {
          throw new ValidationFailedException([
            { path: 'type', message: `Remove its values before making it ${type}.` },
          ]);
        }
      }
      const { updatedAt: _ignored, ...fields } = input;
      await tx.attribute.update({ where: { id }, data: { ...fields, updatedAt: new Date() } });
      await this.audit.record(
        actor,
        {
          action: 'attribute.update',
          entityType: 'attribute',
          entityId: id,
          changes: diff(before as unknown as Record<string, unknown>, fields),
        },
        tx,
      );
    });
    return this.get(id);
  }

  async remove(id: string, actor: AuditActor): Promise<void> {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'attributes', id))) throw attributeNotFound();
      const row = await tx.attribute.findUniqueOrThrow({
        where: { id },
        select: { code: true, _count: { select: { productValues: true, variantValues: true } } },
      });
      const { productValues, variantValues } = row._count;
      if (productValues + variantValues > 0) {
        throw conflict(
          'ATTRIBUTE_IN_USE',
          'Products still use this attribute. Remove it from them first.',
          { products: productValues, variants: variantValues },
        );
      }
      await tx.attribute.delete({ where: { id } });
      await this.audit.record(
        actor,
        {
          action: 'attribute.delete',
          entityType: 'attribute',
          entityId: id,
          changes: { code: row.code },
        },
        tx,
      );
    });
  }

  async addValue(attributeId: string, input: AttributeValueInput, actor: AuditActor) {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'attributes', attributeId))) throw attributeNotFound();
      const attribute = await tx.attribute.findUniqueOrThrow({
        where: { id: attributeId },
        select: { type: true, values: { select: { value: true, position: true } } },
      });
      if (!CHOICE.has(attribute.type)) {
        throw conflict('NO_VALUE_LIST', `${attribute.type} attributes have no value list.`);
      }
      const [value] = valueSlugs([input], new Set(attribute.values.map((v) => v.value)));
      await tx.attributeValue.create({
        data: {
          attributeId,
          value: value ?? '',
          label: input.label,
          swatch: input.swatch ?? null,
          position: input.position ?? Math.max(-1, ...attribute.values.map((v) => v.position)) + 1,
        },
      });
      await this.touchAttribute(tx, attributeId);
      await this.audit.record(
        actor,
        {
          action: 'attribute.value.create',
          entityType: 'attribute',
          entityId: attributeId,
          changes: { value, label: input.label },
        },
        tx,
      );
    });
    return this.get(attributeId);
  }

  async updateValue(
    attributeId: string,
    valueId: string,
    input: z.infer<typeof updateAttributeValueSchema>,
    actor: AuditActor,
  ) {
    await this.write(async (tx) => {
      const before = await tx.attributeValue.findFirst({ where: { id: valueId, attributeId } });
      if (!before) throw valueNotFound();
      await tx.attributeValue.update({ where: { id: valueId }, data: input });
      await this.touchAttribute(tx, attributeId);
      await this.audit.record(
        actor,
        {
          action: 'attribute.value.update',
          entityType: 'attribute',
          entityId: attributeId,
          changes: { value: before.value, ...diff(before, input) },
        },
        tx,
      );
    });
    return this.get(attributeId);
  }

  async removeValue(attributeId: string, valueId: string, actor: AuditActor) {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'attribute_values', valueId))) throw valueNotFound();
      const row = await tx.attributeValue.findFirst({
        where: { id: valueId, attributeId },
        select: { value: true, _count: { select: { productValues: true, variantValues: true } } },
      });
      if (!row) throw valueNotFound();
      const used = row._count.productValues + row._count.variantValues;
      if (used > 0) {
        throw conflict(
          'VALUE_IN_USE',
          `${String(used)} product(s) or variant(s) use "${row.value}". Change them first.`,
          { usage: used },
        );
      }
      await tx.attributeValue.delete({ where: { id: valueId } });
      await this.touchAttribute(tx, attributeId);
      await this.audit.record(
        actor,
        {
          action: 'attribute.value.delete',
          entityType: 'attribute',
          entityId: attributeId,
          changes: { value: row.value },
        },
        tx,
      );
    });
    return this.get(attributeId);
  }

  // ─── Brands ───

  async brands() {
    const rows = await this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        isActive: true,
        updatedAt: true,
        logo: { select: { id: true, storageKey: true, alt: true } },
        _count: { select: { products: true } },
      },
    });
    return rows.map(({ logo, _count, ...b }) => ({
      ...b,
      logo: logo
        ? { id: logo.id, url: mediaUrl(this.baseUrl, logo.storageKey), alt: logo.alt }
        : null,
      products: _count.products,
    }));
  }

  async createBrand(input: z.infer<typeof createBrandSchema>, actor: AuditActor) {
    const id = await this.write(async (tx) => {
      const errors = await checkImages(tx, { logoId: input.logoId });
      if (errors.length) throw new ValidationFailedException(errors);
      const slug =
        input.slug ??
        (await freeSlug(input.name, 'brand', (base) =>
          tx.brand.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } }),
        ));
      const brand = await tx.brand.create({
        data: { ...input, slug, description: input.description ?? null },
        select: { id: true },
      });
      await this.audit.record(
        actor,
        {
          action: 'brand.create',
          entityType: 'brand',
          entityId: brand.id,
          changes: { name: input.name, slug },
        },
        tx,
      );
      return brand.id;
    });
    return this.brand(id);
  }

  async updateBrand(id: string, input: z.infer<typeof updateBrandSchema>, actor: AuditActor) {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'brands', id))) throw brandNotFound();
      const before = await tx.brand.findUniqueOrThrow({ where: { id } });
      assertFresh(before.updatedAt, input.updatedAt, 'brand');
      const errors = await checkImages(tx, { logoId: input.logoId });
      if (errors.length) throw new ValidationFailedException(errors);
      const { updatedAt: _ignored, ...fields } = input;
      await tx.brand.update({ where: { id }, data: { ...fields, updatedAt: new Date() } });
      await this.audit.record(
        actor,
        {
          action: 'brand.update',
          entityType: 'brand',
          entityId: id,
          changes: diff(before, fields),
        },
        tx,
      );
    });
    return this.brand(id);
  }

  async removeBrand(id: string, actor: AuditActor): Promise<void> {
    await this.write(async (tx) => {
      if (!(await lockRow(tx, 'brands', id))) throw brandNotFound();
      const row = await tx.brand.findUniqueOrThrow({
        where: { id },
        select: { name: true, _count: { select: { products: true } } },
      });
      if (row._count.products > 0) {
        throw conflict(
          'BRAND_IN_USE',
          `${String(row._count.products)} product(s) use this brand. Change them first.`,
          { products: row._count.products },
        );
      }
      await tx.brand.delete({ where: { id } });
      await this.audit.record(
        actor,
        { action: 'brand.delete', entityType: 'brand', entityId: id, changes: { name: row.name } },
        tx,
      );
    });
  }

  private async brand(id: string) {
    const found = (await this.brands()).find((b) => b.id === id);
    if (!found) throw brandNotFound();
    return found;
  }

  // ─── Helpers ───

  private touchAttribute(tx: Tx, id: string) {
    return tx.attribute.update({
      where: { id },
      data: { updatedAt: new Date() },
      select: { id: true },
    });
  }

  private async write<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    let result: T;
    try {
      result = await this.prisma.$transaction(work, { timeout: 20_000 });
    } catch (error) {
      if (isUniqueViolation(error, 'code')) throw codeTaken();
      if (isUniqueViolation(error, 'value')) {
        throw conflict('VALUE_TAKEN', 'This attribute already has that value.');
      }
      if (isUniqueViolation(error, 'slug')) {
        throw conflict('SLUG_TAKEN', 'Another brand already uses that URL slug.');
      }
      throw error;
    }
    await this.catalog.invalidate();
    return result;
  }
}

const codeTaken = () => conflict('CODE_TAKEN', 'Another attribute already uses that code.');
const brandNotFound = () => notFound('BRAND_NOT_FOUND', 'Brand not found.');
