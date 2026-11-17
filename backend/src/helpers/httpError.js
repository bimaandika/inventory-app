/** Error dengan status HTTP, ditangkap oleh middlewares/errorHandler.js. */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg = 'Bad request', details) => new HttpError(400, msg, details);
const unauthorized = (msg = 'Unauthorized') => new HttpError(401, msg);
const forbidden = (msg = 'Forbidden') => new HttpError(403, msg);
const notFound = (msg = 'Not found') => new HttpError(404, msg);
const conflict = (msg = 'Conflict') => new HttpError(409, msg);

/** Bungkus handler async supaya error otomatis diteruskan ke next(). */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, asyncHandler };
