'use client';

import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { formatPkMobile } from '@/lib/utils/phone';

import { deleteAddressAction, setDefaultAddressAction } from '../actions';
import type { Address } from '../types';
import { AddressForm } from './address-form';

interface AddressBookProps {
  addresses: Address[];
  defaults: { recipientName: string; phone: string };
}

export function AddressBook({ addresses, defaults }: AddressBookProps) {
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const [confirming, setConfirming] = useState<Address | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove(address: Address) {
    startTransition(async () => {
      await deleteAddressAction(address.id);
      setConfirming(null);
      toast.success('Address deleted');
    });
  }

  function makeDefault(address: Address) {
    startTransition(async () => {
      await setDefaultAddressAction(address.id);
      toast.success(`"${address.label}" is now your default address`);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[28px]">Addresses</h2>
        {addresses.length > 0 ? (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus aria-hidden size={16} />
            Add address
          </Button>
        ) : null}
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Add one now, or tick “Save this address” at checkout."
          action={
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden size={18} />
              Add address
            </Button>
          }
        />
      ) : (
        <ul aria-busy={isPending} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-card border border-gold/60 bg-ivory p-5 data-[default=true]:border-ink"
              data-default={a.isDefault}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-[19px]">{a.label}</p>
                {a.isDefault ? (
                  <span className="rounded-full bg-ink px-3 py-0.5 text-[13px] font-bold text-white">
                    Default
                  </span>
                ) : null}
              </div>
              <address className="flex-1 text-[16px] leading-relaxed not-italic">
                <span className="font-bold">{a.recipientName}</span>
                <br />
                {a.address}
                <br />
                {a.city}
                {a.postalCode ? ` ${a.postalCode}` : ''}
                <br />
                <span className="text-muted">{formatPkMobile(a.phone)}</span>
              </address>
              <div className="flex flex-wrap gap-2 border-t border-gold/40 pt-3">
                <button
                  type="button"
                  onClick={() => setEditing(a)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-semibold hover:bg-sand"
                >
                  <Pencil aria-hidden size={15} /> Edit
                  <span className="sr-only"> {a.label}</span>
                </button>
                {!a.isDefault ? (
                  <button
                    type="button"
                    onClick={() => makeDefault(a)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-semibold hover:bg-sand"
                  >
                    <Star aria-hidden size={15} /> Set as default
                    <span className="sr-only"> ({a.label})</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setConfirming(a)}
                  aria-haspopup="dialog"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-semibold text-muted hover:bg-sand hover:text-ink"
                >
                  <Trash2 aria-hidden size={15} /> Delete
                  <span className="sr-only"> {a.label}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing && editing !== 'new' ? 'Edit address' : 'Add address'}
        size="lg"
      >
        {editing !== null ? (
          <AddressForm
            key={editing === 'new' ? 'new' : editing.id}
            address={editing === 'new' ? undefined : editing}
            defaults={defaults}
            onSaved={() => setEditing(null)}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Delete address?"
        description={
          confirming ? `“${confirming.label}” will be removed from your address book.` : undefined
        }
      >
        <div className="flex justify-end gap-3 px-5 py-5 sm:px-7">
          <Button
            variant="ghost"
            onClick={() => setConfirming(null)}
            className="border-[1.5px] border-gold"
          >
            Cancel
          </Button>
          <Button onClick={() => confirming && remove(confirming)} disabled={isPending}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
