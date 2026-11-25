/* Contact-form inbox (`/admin/inbox`) and newsletter subscribers (`/admin/newsletter`). */
import type { ContactTopic } from '../engagement.js';
import type { OrderStatus, PaymentStatus } from '../orders.js';

export type ContactStatus = 'NEW' | 'READ' | 'ARCHIVED';

interface MessageBase {
  id: string;
  name: string;
  email: string | null;
  /** E.164. */
  phone: string | null;
  subject: string | null;
  topic: ContactTopic;
  orderNumber: string | null;
  /** NEW = nobody has opened it yet. */
  status: ContactStatus;
  /** Internal; never shown to the sender. */
  staffNote: string | null;
  createdAt: string;
  updatedAt: string;
  /** Who last changed its status or note. */
  handledBy: { id: string; name: string } | null;
}

export interface AdminInboxItemDto extends MessageBase {
  /** The first 160 characters of the message. */
  preview: string;
}

/** Newest first; pass `nextCursor` as `before` for the next page (null: no more). */
export interface AdminInboxListDto {
  items: AdminInboxItemDto[];
  nextCursor: string | null;
}

export interface AdminMessageDto extends MessageBase {
  message: string;
  /** The order it mentions, when that order exists. */
  order: {
    number: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    totalMinor: number;
  } | null;
}

export type AdminInboxCountsDto = Record<ContactStatus, number>;

export type SubscriberStatus = 'SUBSCRIBED' | 'UNSUBSCRIBED';

export interface AdminSubscriberDto {
  id: string;
  email: string;
  status: SubscriberStatus;
  /** Where they signed up (footer, checkout…). */
  source: string | null;
  consentAt: string;
  unsubscribedAt: string | null;
  createdAt: string;
}

export interface AdminSubscriberListDto {
  items: AdminSubscriberDto[];
  nextCursor: string | null;
}

export type AdminSubscriberCountsDto = Record<SubscriberStatus, number>;
