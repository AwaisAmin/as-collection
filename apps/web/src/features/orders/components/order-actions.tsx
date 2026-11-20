'use client';

import { CircleAlert, Upload, XCircle } from 'lucide-react';
import { useActionState, useEffect, useId, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScreenshotUpload } from '@/features/checkout/components/screenshot-upload';

import { cancelOrderAction, type OrderFormState, uploadPaymentProofAction } from '../actions';

interface OrderRef {
  orderNumber: string;
  /** Confirmation-link key; omitted on account pages (the session is used). */
  accessKey?: string;
}

const idle: OrderFormState = { status: 'idle' };

/**
 * Transfer screenshot upload for a placed order: shown when no screenshot arrived yet (e.g. the
 * upload failed at checkout) or the last one was not accepted.
 */
export function PaymentProofForm({
  orderNumber,
  accessKey,
  rejected,
}: OrderRef & { rejected: boolean }) {
  const [state, action, pending] = useActionState(uploadPaymentProofAction, idle);
  const base = useId();

  useEffect(() => {
    if (state.status === 'success') toast.success(state.message);
  }, [state]);

  return (
    <form
      action={action}
      className="flex w-full flex-col gap-4 rounded-card border border-gold bg-ivory p-5 text-left sm:p-6"
    >
      <div className="flex gap-3">
        <CircleAlert aria-hidden className="mt-0.5 size-6 shrink-0 text-gold-dark" />
        <div>
          <h2 className="font-display text-[21px]">
            {rejected ? 'Please upload a new payment screenshot' : 'Upload your payment screenshot'}
          </h2>
          <p className="text-[16px] text-muted">
            {rejected
              ? 'We couldn’t verify the last screenshot. Upload a clear one showing the amount and transaction ID.'
              : 'We’ll confirm your order as soon as we verify the transfer.'}
          </p>
        </div>
      </div>
      <input type="hidden" name="orderNumber" value={orderNumber} />
      {accessKey ? <input type="hidden" name="key" value={accessKey} /> : null}
      <ScreenshotUpload id={`${base}-screenshot`} name="screenshot" />
      <label className="flex flex-col gap-1.5" htmlFor={`${base}-ref`}>
        <span className="px-1 font-display text-[16px]">
          Transaction ID <span className="text-[14px] text-muted">(optional)</span>
        </span>
        <Input id={`${base}-ref`} name="transactionRef" maxLength={40} autoComplete="off" />
      </label>
      {state.status === 'error' ? (
        <p role="alert" className="text-[15px] font-semibold text-gold-dark">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-fit">
        <Upload aria-hidden size={17} />
        {pending ? 'Uploading…' : 'Send screenshot'}
      </Button>
    </form>
  );
}

/** "Cancel order" with a confirmation step (pending, unpaid orders only). */
export function CancelOrderButton({ orderNumber, accessKey }: OrderRef) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const result = await cancelOrderAction(orderNumber, accessKey);
      setOpen(false);
      if (result.ok) toast.success(`Order ${orderNumber} cancelled`);
      else toast.error(result.error);
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="gap-2 border-[1.5px] border-gold"
      >
        <XCircle aria-hidden size={18} />
        Cancel order
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel this order?"
        description={`Order ${orderNumber} will be cancelled and its items released. This can’t be undone.`}
      >
        <div className="flex justify-end gap-3 px-5 py-5 sm:px-7">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="border-[1.5px] border-gold"
          >
            Keep order
          </Button>
          <Button onClick={cancel} disabled={pending}>
            {pending ? 'Cancelling…' : 'Yes, cancel it'}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
