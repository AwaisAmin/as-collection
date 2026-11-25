import type { AdminMessageDto } from '@as/contracts';
import { ArrowLeft, Mail, MessageCircle, Phone } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  MarkReadOnView,
  StaffNoteForm,
  StatusButtons,
} from '@/features/inbox/components/message-actions';
import { MESSAGE_STATUS, TOPIC_LABEL, whatsappHref } from '@/features/inbox/labels';
import { ORDER_STATUS, PAYMENT_STATUS } from '@/features/orders/labels';
import { apiFindOrNull } from '@/lib/api/http-client';
import { formatDateTime, formatMoney, formatPhone } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Message' };

export default async function MessagePage({ params }: PageProps<'/inbox/[id]'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'inbox.read')) {
    return <Alert tone="error">Your role does not include the inbox.</Alert>;
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const message = await apiFindOrNull<AdminMessageDto>(`/admin/inbox/${id}`, { token });
  if (!message) notFound();
  const title = message.subject ?? TOPIC_LABEL[message.topic];
  const status = MESSAGE_STATUS[message.status];
  const replySubject = encodeURIComponent(`Re: ${title} – AS Collection`);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <MarkReadOnView id={message.id} isNew={message.status === 'NEW'} />
      <div className="flex flex-col gap-3">
        <Link
          href="/inbox"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden size={16} />
          Inbox
        </Link>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[22px] font-semibold wrap-break-word">{title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>{TOPIC_LABEL[message.topic]}</span>
            <span>· {formatDateTime(message.createdAt)}</span>
          </div>
        </div>
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[16px] font-semibold">{message.name}</h2>
          <p className="text-[14px] wrap-break-word text-muted">
            {[message.email, message.phone ? formatPhone(message.phone) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <p className="text-[15px] wrap-break-word whitespace-pre-line">{message.message}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {message.email ? (
            <a
              href={`mailto:${message.email}?subject=${replySubject}`}
              className={buttonClasses('primary', 'md', 'w-full sm:w-auto')}
            >
              <Mail aria-hidden size={16} />
              Reply by email
            </a>
          ) : null}
          {message.phone ? (
            <>
              <a
                href={whatsappHref(message.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses('secondary', 'md', 'w-full sm:w-auto')}
              >
                <MessageCircle aria-hidden size={16} />
                WhatsApp
              </a>
              <a
                href={`tel:${message.phone}`}
                className={buttonClasses('secondary', 'md', 'w-full sm:w-auto')}
              >
                <Phone aria-hidden size={16} />
                Call
              </a>
            </>
          ) : null}
        </div>
      </Card>

      {message.orderNumber ? (
        <Card className="flex flex-col gap-2 p-5">
          <h2 className="text-[16px] font-semibold">Order {message.orderNumber}</h2>
          {message.order ? (
            <div className="flex flex-wrap items-center gap-2 text-[14px]">
              <Badge tone={ORDER_STATUS[message.order.status].tone}>
                {ORDER_STATUS[message.order.status].label}
              </Badge>
              <Badge tone={PAYMENT_STATUS[message.order.paymentStatus].tone}>
                {PAYMENT_STATUS[message.order.paymentStatus].label}
              </Badge>
              <span className="tabular-nums">{formatMoney(message.order.totalMinor)}</span>
              {can(permissions, 'orders.read') ? (
                <Link
                  href={`/orders/${message.order.number}` as Route}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  Open order
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="text-[14px] text-muted">
              No order has this number. Ask the customer to check it.
            </p>
          )}
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4 p-5">
        {/* Restarts from the stored note after a save (not when only the status changes). */}
        <StaffNoteForm key={message.staffNote ?? ''} message={message} />
        <div className="border-line flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-muted">
            {message.handledBy
              ? `Last changed by ${message.handledBy.name}, ${formatDateTime(message.updatedAt)}`
              : 'Nobody has handled it yet.'}
          </p>
          <StatusButtons message={message} />
        </div>
      </Card>
    </div>
  );
}
