'use client';

import { CircleCheck, PenLine } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { StarRatingInput } from '@/components/ui/star-rating-input';
import { Textarea } from '@/components/ui/textarea';
import { useDisclosure } from '@/hooks/use-disclosure';

import { submitReview } from '../actions';
import { initialReviewFormState, REVIEW_HONEYPOT } from '../types';

const BODY_MAX = 1500;

interface WriteReviewProps {
  productSlug: string;
  productName: string;
  /** "Be the first to review" empty-state wording. */
  first?: boolean;
}

export function WriteReview({ productSlug, productName, first = false }: WriteReviewProps) {
  const { isOpen, open, close } = useDisclosure();
  // Remount the form each time the dialog opens so a previous success/error is cleared.
  const [session, setSession] = useState(0);

  return (
    <>
      <Button
        onClick={() => {
          setSession((s) => s + 1);
          open();
        }}
        aria-haspopup="dialog"
        className="w-full sm:w-auto"
      >
        <PenLine aria-hidden size={18} />
        {first ? 'Be the first to review' : 'Write a review'}
      </Button>

      <Dialog
        open={isOpen}
        onClose={close}
        title="Write a review"
        description={productName}
        size="lg"
      >
        <ReviewForm key={session} productSlug={productSlug} onDone={close} />
      </Dialog>
    </>
  );
}

function ReviewForm({ productSlug, onDone }: { productSlug: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(submitReview, initialReviewFormState);
  const [bodyLength, setBodyLength] = useState(0);
  const [edited, setEdited] = useState<{ at: number; names: string[] }>({ at: -1, names: [] });
  const base = useId();
  const ratingLabelId = `${base}-rating-label`;

  if (state.status === 'success') {
    return (
      <div role="status" className="flex flex-col items-center gap-4 px-6 py-12 text-center">
        <span className="flex size-16 items-center justify-center rounded-full border border-gold bg-cream">
          <CircleCheck aria-hidden className="size-8 text-gold-dark" strokeWidth={1.5} />
        </span>
        <h3 className="font-display text-[26px]">Thank you for your review!</h3>
        <p className="max-w-sm text-[17px] text-muted">
          Your review has been submitted and will appear on the product page after it is approved.
        </p>
        <Button onClick={onDone} className="mt-2">
          Done
        </Button>
      </div>
    );
  }

  const formKey = state.status === 'error' ? state.at : 0;
  // A field's error goes away as soon as it is changed (not only on the next submit).
  const allErrors: Partial<Record<string, string>> =
    state.status === 'error' ? state.fieldErrors : {};
  const errors = Object.fromEntries(
    Object.entries(allErrors).filter(
      ([name]) => !(edited.at === formKey && edited.names.includes(name)),
    ),
  ) as typeof allErrors;
  const values = state.status === 'error' ? state.values : {};

  return (
    <form
      action={formAction}
      noValidate
      key={formKey}
      onChange={(event) => {
        const target = event.target;
        const name =
          target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
            ? target.name
            : '';
        if (!name || !allErrors[name]) return;
        setEdited((current) => ({
          at: formKey,
          names: current.at === formKey ? [...current.names, name] : [name],
        }));
      }}
      className="flex flex-col gap-5 px-5 py-6 sm:px-7"
    >
      <input type="hidden" name="productSlug" value={productSlug} />

      {state.status === 'error' && state.message ? (
        <p
          role="alert"
          className="rounded-xl border border-gold bg-sand px-4 py-3 text-[16px] font-semibold text-ink"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <p id={ratingLabelId} className="px-1 font-display text-[16px] text-ink">
          Your rating{' '}
          <span aria-hidden className="text-gold-dark">
            *
          </span>
        </p>
        <StarRatingInput
          name="rating"
          labelledBy={ratingLabelId}
          defaultValue={Number(values.rating) || 0}
          invalid={Boolean(errors.rating)}
          describedBy={errors.rating ? `${base}-rating-error` : undefined}
        />
        {errors.rating ? (
          <p id={`${base}-rating-error`} className="px-1 text-[15px] font-semibold text-gold-dark">
            {errors.rating}
          </p>
        ) : null}
      </div>

      <FormField id={`${base}-title`} label="Review title" required error={errors.title}>
        {(a11y) => (
          <Input
            {...a11y}
            name="title"
            maxLength={80}
            defaultValue={values.title}
            placeholder="Sum it up in a few words"
          />
        )}
      </FormField>

      <FormField
        id={`${base}-body`}
        label="Your review"
        required
        error={errors.body}
        hint="What did you like? How was the fit, fabric or shade?"
        aside={
          <span aria-hidden className="text-[13px] text-muted">
            {bodyLength}/{BODY_MAX}
          </span>
        }
      >
        {(a11y) => (
          <Textarea
            {...a11y}
            name="body"
            maxLength={BODY_MAX}
            defaultValue={values.body}
            onChange={(e) => setBodyLength(e.target.value.length)}
          />
        )}
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id={`${base}-author`} label="Your name" required error={errors.author}>
          {(a11y) => (
            <Input
              {...a11y}
              name="author"
              autoComplete="name"
              maxLength={60}
              defaultValue={values.author}
            />
          )}
        </FormField>
        <FormField id={`${base}-city`} label="City" error={errors.city}>
          {(a11y) => (
            <Input
              {...a11y}
              name="city"
              autoComplete="address-level2"
              maxLength={60}
              defaultValue={values.city}
              placeholder="e.g. Lahore"
            />
          )}
        </FormField>
      </div>

      {/* Honeypot — hidden from people and assistive tech */}
      <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${base}-hp`}>Website</label>
        <input id={`${base}-hp`} name={REVIEW_HONEYPOT} tabIndex={-1} autoComplete="off" />
      </div>

      <p className="text-[14px] text-muted">
        Reviews are checked before publishing. Please don&apos;t include personal contact details.
      </p>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:self-end">
        {pending ? 'Submitting…' : 'Submit review'}
      </Button>
    </form>
  );
}
