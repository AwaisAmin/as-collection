/** What a form's server action returns to the page. */
export interface ActionState {
  /** Set on success; shown as a toast (dialogs close). */
  done?: string;
  error?: string;
  /** Messages per form field name. */
  fieldErrors?: Record<string, string>;
  /** Changes on every result, so repeated identical outcomes still register. */
  at?: number;
}

/** What a JSON editor's save action returns (product, category… editors). */
export interface SaveState {
  done?: string;
  error?: string;
  /** API field errors by dotted path (`name`, `variants.0.sku`, `media.2.mediaId`). */
  errors?: Record<string, string>;
  /** Someone else saved the record meanwhile (nothing was overwritten). */
  stale?: boolean;
  at?: number;
}
