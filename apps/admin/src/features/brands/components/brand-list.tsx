'use client';

import type { AdminBrandDto } from '@as/contracts';
import { ImageOff, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { ActionDialog } from '@/components/ui/action-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { type ChosenImage, ImageField } from '@/features/media/components/image-field';

import { deleteBrand, saveBrand } from '../actions';

function BrandFields({
  brand,
  errors,
  canUpload,
}: {
  brand: AdminBrandDto | null;
  errors: Record<string, string>;
  canUpload: boolean;
}) {
  const id = useId();
  const [logo, setLogo] = useState<ChosenImage | null>(brand?.logo ?? null);
  return (
    <>
      {brand ? <input type="hidden" name="updatedAt" value={brand.updatedAt} /> : null}
      <input type="hidden" name="logoId" value={logo?.id ?? ''} />
      <Field id={`${id}-name`} label="Name" error={errors.name} required>
        {(control) => (
          <Input {...control} name="name" defaultValue={brand?.name} maxLength={120} autoFocus />
        )}
      </Field>
      <Field
        id={`${id}-slug`}
        label="Web address"
        hint={brand ? 'Changing it breaks saved links.' : 'Leave empty to make one from the name.'}
        error={errors.slug}
      >
        {(control) => (
          <Input
            {...control}
            name="slug"
            defaultValue={brand?.slug}
            maxLength={120}
            autoComplete="off"
          />
        )}
      </Field>
      <Field id={`${id}-description`} label="Description" error={errors.description}>
        {(control) => (
          <Textarea
            {...control}
            name="description"
            rows={3}
            defaultValue={brand?.description ?? ''}
            maxLength={2000}
          />
        )}
      </Field>
      <div className="max-w-40">
        <ImageField
          label="Logo"
          value={logo}
          onChange={setLogo}
          canUpload={canUpload}
          error={errors.logoId}
        />
      </div>
      <Checkbox
        name="isActive"
        defaultChecked={brand?.isActive ?? true}
        label="Shown in the shop"
      />
    </>
  );
}

function DeleteBrand({ brand }: { brand: AdminBrandDto }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`Delete ${brand.name}`}
      title="Delete (no products)"
      className="hover:text-danger"
      onClick={() =>
        start(async () => {
          const result = await deleteBrand(brand.id);
          if (result.done) toast.success(result.done);
          else toast.error(result.error ?? 'Could not delete the brand.');
        })
      }
    >
      <Trash2 aria-hidden size={15} />
    </Button>
  );
}

/** Brands with their logo and product count; add and edit in dialogs. */
export function BrandList({
  brands,
  canWrite,
  canUpload,
}: {
  brands: readonly AdminBrandDto[];
  canWrite: boolean;
  canUpload: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {canWrite ? (
        <div className="flex justify-end">
          <ActionDialog
            trigger={
              <>
                <Plus aria-hidden size={16} />
                New brand
              </>
            }
            triggerVariant="primary"
            title="New brand"
            submitLabel="Add brand"
            action={saveBrand.bind(null, null)}
          >
            {(errors) => <BrandFields brand={null} errors={errors} canUpload={canUpload} />}
          </ActionDialog>
        </div>
      ) : null}
      {brands.length ? (
        <ul className="border-line bg-surface shadow-card divide-line flex flex-col divide-y rounded-card border">
          {brands.map((brand) => (
            <li key={brand.id} className="flex items-center gap-3 px-4 py-3">
              <span className="border-line bg-canvas flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                {brand.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- library thumbnail
                  <img src={brand.logo.url} alt="" className="size-full object-contain" />
                ) : (
                  <ImageOff aria-hidden size={16} className="text-muted" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {brand.name}
                  {!brand.isActive ? <Badge>Hidden</Badge> : null}
                </p>
                <p className="text-[13px] text-muted">
                  {brand.products ? (
                    <Link href={`/products?brand=${brand.id}` as Route} className="hover:underline">
                      {brand.products} {brand.products === 1 ? 'product' : 'products'}
                    </Link>
                  ) : (
                    'No products'
                  )}{' '}
                  · /{brand.slug}
                </p>
              </div>
              {canWrite ? (
                <div className="flex shrink-0 items-center gap-1">
                  <ActionDialog
                    trigger={<Pencil aria-hidden size={15} />}
                    triggerLabel={`Edit ${brand.name}`}
                    triggerVariant="ghost"
                    triggerSize="sm"
                    triggerClassName="w-auto"
                    title={`Edit ${brand.name}`}
                    submitLabel="Save brand"
                    action={saveBrand.bind(null, brand.id)}
                  >
                    {(errors) => (
                      <BrandFields brand={brand} errors={errors} canUpload={canUpload} />
                    )}
                  </ActionDialog>
                  {brand.products === 0 ? <DeleteBrand brand={brand} /> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-line bg-surface rounded-card border border-dashed px-6 py-12 text-center">
          <p className="font-medium">No brands yet</p>
          <p className="text-[14px] text-muted">
            Brands are optional: add them if you sell other labels.
          </p>
        </div>
      )}
    </div>
  );
}
