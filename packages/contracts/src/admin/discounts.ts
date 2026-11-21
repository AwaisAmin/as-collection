/* Discount codes (`/admin/discounts`). */
import type { AdminPage } from './common.js';

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';

/** What checkout would do with the code right now. */
export type DiscountState = 'active' | 'scheduled' | 'expired' | 'used-up' | 'inactive';

export interface AdminDiscountDto {
  id: string;
  /** Upper-case; customers may type it in any case. */
  code: string;
  description: string | null;
  type: DiscountType;
  /** PERCENTAGE: basis points (1500 = 15 %); FIXED_AMOUNT: paisa; FREE_SHIPPING: 0. */
  value: number;
  minSubtotalMinor: number | null;
  /** Cap for percentage discounts. */
  maxDiscountMinor: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  isActive: boolean;
  state: DiscountState;
  createdAt: string;
  /** Send back as `updatedAt` when saving (conflict detection). */
  updatedAt: string;
}

export type AdminDiscountListDto = AdminPage<AdminDiscountDto>;

export interface AdminDiscountDetailDto extends AdminDiscountDto {
  stats: {
    /** Orders (not cancelled) that used the code. */
    orders: number;
    discountGivenMinor: number;
    revenueMinor: number;
  };
}
