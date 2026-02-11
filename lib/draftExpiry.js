const DRAFT_EXPIRY_MINUTES = 10;

const getDraftExpiryIso = (minutes = DRAFT_EXPIRY_MINUTES, now = new Date()) =>
  new Date(now.getTime() + minutes * 60 * 1000).toISOString();

const isDraftExpired = (booking, now = new Date()) => {
  if (!booking || booking.status !== 'DRAFT') return false;
  if (!booking.expires_at) return false;
  const expiresAt = new Date(booking.expires_at).getTime();
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt < now.getTime();
};

const expireStaleDrafts = async (supabase, nowIso = new Date().toISOString()) => {
  const now = new Date(nowIso);
  const legacyCutoffIso = new Date(now.getTime() - DRAFT_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { data: withExpiry, error: withExpiryError } = await supabase
    .from('bookings')
    .update({ status: 'EXPIRED' })
    .eq('status', 'DRAFT')
    .lt('expires_at', nowIso)
    .select('id');

  if (withExpiryError) throw withExpiryError;

  const { data: legacyRows, error: legacyError } = await supabase
    .from('bookings')
    .update({ status: 'EXPIRED' })
    .eq('status', 'DRAFT')
    .is('expires_at', null)
    .lt('created_at', legacyCutoffIso)
    .select('id');

  if (legacyError) throw legacyError;

  return [...(withExpiry ?? []), ...(legacyRows ?? [])].map((row) => String(row.id));
};

module.exports = {
  DRAFT_EXPIRY_MINUTES,
  getDraftExpiryIso,
  isDraftExpired,
  expireStaleDrafts
};
