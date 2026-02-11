type AdminPushBooking = {
  id: string;
  booking_ref?: string | null;
  room_name?: string | null;
  start_at?: string | null;
  customer_name?: string | null;
};

const ONESIGNAL_API_URL = 'https://api.onesignal.com/notifications?c=push';

const parseStartLabel = (startAt?: string | null): string => {
  if (!startAt) return 'Unknown time';
  const ts = Date.parse(startAt);
  if (!Number.isFinite(ts)) return 'Unknown time';
  return new Date(ts).toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

export async function sendAdminNewBookingPush(booking: AdminPushBooking): Promise<void> {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) return;

  const ref = booking.booking_ref || booking.id;
  const title = 'New Booking Confirmed';
  const body = `${ref} • ${booking.room_name || 'Room'} • ${parseStartLabel(booking.start_at)}`;

  const payload = {
    app_id: appId,
    headings: { en: title },
    contents: { en: body },
    filters: [{ field: 'tag', key: 'role', relation: '=', value: 'admin' }],
    web_url: '/admin'
  };

  try {
    const response = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn('[ADMIN PUSH] OneSignal send failed.', response.status, text);
    }
  } catch (error) {
    console.warn('[ADMIN PUSH] Unexpected error.', error);
  }
}
