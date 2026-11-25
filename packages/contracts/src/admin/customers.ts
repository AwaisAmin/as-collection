/* Customer accounts (`/admin/customers`). */
import type { OrderStatus, PaymentMethod, PaymentStatus } from '../orders.js';
import type { AdminPage } from './common.js';

export type CustomerStatus = 'ACTIVE' | 'BLOCKED';

export interface AdminCustomerListItemDto {
  id: string;
  name: string | null;
  /** E.164; null for Google-only accounts that never added one. */
  phone: string | null;
  email: string | null;
  status: CustomerStatus;
  marketingOptIn: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Orders that count as spending (not cancelled). */
  orders: number;
  spentMinor: number;
  lastOrderAt: string | null;
}

export type AdminCustomerListDto = AdminPage<AdminCustomerListItemDto>;

export interface AdminCustomerAddressDto {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string | null;
  postalCode: string | null;
  isDefault: boolean;
}

export interface AdminCustomerOrderDto {
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  totalMinor: number;
  createdAt: string;
}

export interface AdminCustomerDto {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: CustomerStatus;
  /** Internal: why staff blocked the account. */
  blockedReason: string | null;
  blockedAt: string | null;
  /** Internal; never shown to the customer. */
  staffNote: string | null;
  marketingOptIn: boolean;
  phoneVerifiedAt: string | null;
  emailVerifiedAt: string | null;
  /** Signs in with Google. */
  hasGoogle: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Send back as `updatedAt` when editing (conflict detection). */
  updatedAt: string;
  addresses: AdminCustomerAddressDto[];
  /** The latest 10. */
  recentOrders: AdminCustomerOrderDto[];
  stats: {
    /** Every order, cancelled ones included. */
    orders: number;
    /** Orders that count as spending (not cancelled). */
    countedOrders: number;
    spentMinor: number;
    reviews: number;
    /** Devices signed in right now. */
    activeSessions: number;
  };
}
