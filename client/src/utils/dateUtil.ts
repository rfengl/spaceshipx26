export const formatDateTime = (at: string) =>
  new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
