/* Shapes shared by many admin endpoints. */

/** One page of a staff list (`page` is 1-based). */
export interface AdminPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** A staff member named on a record (who reviewed it, who wrote the note…). */
export interface StaffRefDto {
  id: string;
  name: string;
}
