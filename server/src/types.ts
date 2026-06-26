// An Error that carries an HTTP status code, recognized by the error handler.
export interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}
