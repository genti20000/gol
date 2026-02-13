import { BASE_DURATION_HOURS, SLOT_MINUTES } from '@/constants';
import { isBlockingBookingForAvailability, overlapsRange } from '@/lib/availabilityRules';
import { expireStaleDrafts } from '@/lib/draftExpiry';
import { pickClosestAlternatives } from '@/lib/slotAlternatives';

type AvailabilityInput = {
  date: string;
  guests: number;
  extraHours: number;
  serviceId: string;
};

const getWindowForDate = async (supabase: any, date: string) => {
  const { data: special } = await supabase
    .from('special_hours')
    .select('enabled,open_time,close_time')
    .eq('date', date)
    .maybeSingle();

  if (special) {
    if (!special.enabled) return null;
    return { open: String(special.open_time || ''), close: String(special.close_time || '') };
  }

  const day = new Date(`${date}T00:00:00`).getDay();
  const { data: regular } = await supabase
    .from('operating_hours')
    .select('enabled,open_time,close_time')
    .eq('day', day)
    .maybeSingle();

  if (!regular || !regular.enabled) return null;
  return { open: String(regular.open_time || ''), close: String(regular.close_time || '') };
};

export { pickClosestAlternatives };

export const getLiveAvailability = async (supabase: any, input: AvailabilityInput): Promise<string[]> => {
  const { date, guests, extraHours, serviceId } = input;

  await expireStaleDrafts(supabase).catch(() => null);

  const { data: service, error: serviceError } = await supabase
    .from('services')
    .select('id,is_active,min_people,max_people')
    .eq('id', serviceId)
    .maybeSingle();

  if (serviceError || !service || !service.is_active) return [];
  if (guests < service.min_people || guests > service.max_people) return [];

  const { data: settings } = await supabase
    .from('venue_settings')
    .select('min_days_before_booking,min_hours_before_booking')
    .maybeSingle();

  const operatingWindow = await getWindowForDate(supabase, date);
  if (!operatingWindow) return [];

  const [openH, openM] = operatingWindow.open.split(':').map((v: string) => parseInt(v, 10));
  let [closeH, closeM] = operatingWindow.close.split(':').map((v: string) => parseInt(v, 10));
  if (!Number.isFinite(openH) || !Number.isFinite(openM) || !Number.isFinite(closeH) || !Number.isFinite(closeM)) {
    return [];
  }
  if (closeH <= openH) closeH += 24;

  const totalDurationMinutes = (BASE_DURATION_HOURS + extraHours) * 60;
  const startMin = openH * 60 + openM;
  const endMin = closeH * 60 + closeM;

  const [year, month, day] = date.split('-').map((part) => parseInt(part, 10));
  const baseTs = new Date(year, month - 1, day, 0, 0, 0).getTime();
  const dayStart = new Date(baseTs + startMin * 60000);
  const dayEnd = new Date(baseTs + endMin * 60000);

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id')
    .eq('is_active', true);
  const roomIds = (rooms ?? []).map((room: any) => room.id);
  if (roomIds.length === 0) return [];

  const { data: bookings } = await supabase
    .from('bookings')
    .select('room_id,start_at,end_at,status,expires_at')
    .in('room_id', roomIds)
    .lt('start_at', dayEnd.toISOString())
    .gt('end_at', dayStart.toISOString());

  const { data: blocks } = await supabase
    .from('room_blocks')
    .select('room_id,start_at,end_at')
    .in('room_id', roomIds)
    .lt('start_at', dayEnd.toISOString())
    .gt('end_at', dayStart.toISOString());

  const minDays = Math.max(0, Number(settings?.min_days_before_booking ?? 0));
  const minHours = Math.max(0, Number(settings?.min_hours_before_booking ?? 0));
  const minStartTs = Date.now() + (minDays * 24 + minHours) * 3600000;
  const nowMs = Date.now();

  const blockingBookings = (bookings ?? []).filter((booking: any) => isBlockingBookingForAvailability(booking, nowMs));
  const validTimes: string[] = [];

  for (let minute = startMin; minute <= endMin - totalDurationMinutes; minute += SLOT_MINUTES) {
    const slotStartTs = baseTs + minute * 60000;
    const slotEndTs = slotStartTs + totalDurationMinutes * 60000;
    if (slotStartTs < minStartTs) continue;

    const hasRoom = roomIds.some((roomId: string) => {
      const bookingConflict = blockingBookings.some((booking: any) => {
        if (booking.room_id !== roomId) return false;
        const bookingStart = Date.parse(String(booking.start_at || ''));
        const bookingEnd = Date.parse(String(booking.end_at || ''));
        if (!Number.isFinite(bookingStart) || !Number.isFinite(bookingEnd)) return false;
        return overlapsRange(slotStartTs, slotEndTs, bookingStart, bookingEnd);
      });
      if (bookingConflict) return false;

      const blockConflict = (blocks ?? []).some((block: any) => {
        if (block.room_id !== roomId) return false;
        const blockStart = Date.parse(String(block.start_at || ''));
        const blockEnd = Date.parse(String(block.end_at || ''));
        if (!Number.isFinite(blockStart) || !Number.isFinite(blockEnd)) return false;
        return overlapsRange(slotStartTs, slotEndTs, blockStart, blockEnd);
      });

      return !blockConflict;
    });

    if (hasRoom) {
      const slotDate = new Date(slotStartTs);
      validTimes.push(`${slotDate.getHours().toString().padStart(2, '0')}:${slotDate.getMinutes().toString().padStart(2, '0')}`);
    }
  }

  return validTimes;
};
