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
