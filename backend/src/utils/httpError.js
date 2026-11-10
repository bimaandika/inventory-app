/** Error dengan status HTTP, ditangkap oleh errorHandler. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg = 'Bad request', details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Unauthorized') => new HttpError(401, msg);
export const forbidden = (msg = 'Forbidden') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const conflict = (msg = 'Conflict') => new HttpError(409, msg);

/** Bungkus handler async supaya error otomatis diteruskan ke next(). */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
