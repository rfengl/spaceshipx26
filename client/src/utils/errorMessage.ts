/** Normalize an unknown thrown value into a user-facing message. */
export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'Something went wrong';
