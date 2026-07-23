import { getOrCreateUser } from '../services/progress.js';

// Lightweight identity: the client sends an `x-user-id` header. If absent we
// fall back to a shared demo user so the app works with zero setup. This is
// the single seam to replace with real authentication later.
export async function attachUser(req, res, next) {
  try {
    const externalId = req.header('x-user-id') || 'demo-user';
    req.user = await getOrCreateUser(externalId);
    next();
  } catch (err) {
    next(err);
  }
}
