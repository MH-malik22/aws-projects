// 404 for unmatched API routes.
export function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

// Central error handler. Uses err.status when set, else 500.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: err.publicMessage || err.message || 'Internal server error' });
}

// Helper to throw an error with an HTTP status.
export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.publicMessage = message;
  return err;
}
