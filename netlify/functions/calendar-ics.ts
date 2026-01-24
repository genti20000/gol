import { Handler } from '@netlify/functions';
import fs from 'fs';

const SNAPSHOT_PATH = '/tmp/lkc_calendar_snapshot.json';

const formatIcsDate = (iso: string) => {
  return iso.replace(/[-:]/g, '').split('.')[0] + 'Z';
};

const escapeIcs = (str: string) => {
  if (!str) return '';
  return str.replace(/[\\,;]/g, (match) => `\\${match}`).replace(/\n/g, '\\n');
};

export const handler: Handler = async (event) => {
  const queryToken = event.queryStringParameters?.token;

  if (!queryToken) {
    return { statusCode: 401, body: 'Missing token' };
  }

  let snapshot: any = null;
  if (fs.existsSync(SNAPSHOT_PATH)) {
    try {
      snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
    } catch (e) {
      console.error("Failed to read snapshot", e);
    }
  }

  // Security check: provided token must match stored snapshot token
  if (snapshot && snapshot.token !== queryToken) {
    return { statusCode: 403, body: 'Invalid token' };
  }

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//London Karaoke Club//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:London Karaoke Club Bookings',
    'X-WR-TIMEZONE:UTC'
  ];

  if (snapshot) {
    const { bookings, blocks, includeCustomerName, includeBlocks, includePending } = snapshot;

    // Process Bookings
    (bookings || []).forEach((b: any) => {
      // Filter logic
      if (b.status === 'CANCELLED' || b.status === 'NO_SHOW') return;
      if (b.status === 'PENDING' && !includePending) return;

      const summary = includeCustomerName 
        ? `${b.room_name} - ${b.customer_name}` 
        : `${b.room_name} Session`;
      
      const description = [
        `Status: ${b.status}`,
        `Guests: ${b.guests}`,
        b.notes ? `Notes: ${b.notes}` : ''
      ].filter(Boolean).join('\\n');

      icsLines.push('BEGIN:VEVENT');
      icsLines.push(`UID:booking-${b.id}@lkc`);
      icsLines.push(`DTSTAMP:${formatIcsDate(new Date().toISOString())}`);
      icsLines.push(`DTSTART:${formatIcsDate(b.start_at)}`);
      icsLines.push(`DTEND:${formatIcsDate(b.end_at)}`);
      icsLines.push(`SUMMARY:${escapeIcs(summary)}`);
      icsLines.push(`DESCRIPTION:${escapeIcs(description)}`);
      icsLines.push('END:VEVENT');
    });

    // Process Blocks
    if (includeBlocks !== false) { // Default true if not defined
      (blocks || []).forEach((bl: any) => {
        const room = snapshot.rooms?.find((r: any) => r.id === bl.roomId);
        const roomName = room ? room.name : 'Unknown Room';
        
        icsLines.push('BEGIN:VEVENT');
        icsLines.push(`UID:block-${bl.id}@lkc`);
        icsLines.push(`DTSTAMP:${formatIcsDate(new Date().toISOString())}`);
        icsLines.push(`DTSTART:${formatIcsDate(bl.start_at)}`);
        icsLines.push(`DTEND:${formatIcsDate(bl.end_at)}`);
        icsLines.push(`SUMMARY:${escapeIcs(`Blocked - ${roomName}`)}`);
        icsLines.push(`DESCRIPTION:${escapeIcs(bl.reason || 'Manual block')}`);
        icsLines.push('END:VEVENT');
      });
    }
  }

  icsLines.push('END:VCALENDAR');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="lkc_bookings.ics"',
      'Cache-Control': 'no-cache'
    },
    body: icsLines.join('\r\n')
  };
};