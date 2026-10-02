import { bookingDisplayStatus, bayAreaBookingDate, type ServiceBooking, type ServiceBookingInbox } from '../../lib/service-bookings';
import type { Outing } from '../../lib/outings';
import type { SavedPlan } from '../../lib/planner';
import { buildItinerary, validClock } from '../../lib/planner-itinerary';

export type BookingConflict = { id: string; kind: 'booking' | 'outing' | 'plan'; title: string; href: string };
export function myBookingNeedsReply(booking: ServiceBooking, userId: string, now: number): boolean {
  return (bookingDisplayStatus(booking, now) === 'pending' && booking.providerId === userId)
    || (booking.status === 'confirmed' && booking.startAt > now && booking.reschedule?.status === 'pending' && booking.reschedule.expiresAt > now && booking.reschedule.proposedBy !== userId);
}
export function selectMyWeekBookings(inbox: ServiceBookingInbox, userId: string, now: number) {
  const today = bayAreaBookingDate(new Date(now)), end = new Date(`${today}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 6);
  const weekEnd = end.toISOString().slice(0, 10);
  const all = [...inbox.asCustomer, ...inbox.asProvider].filter((booking, index, rows) =>
    [booking.providerId, booking.customerId].includes(userId) && rows.findIndex(row => row.id === booking.id && row.providerId === booking.providerId) === index);
  const active = all.filter(row => ['pending', 'confirmed'].includes(bookingDisplayStatus(row, now)) && row.endAt > now);
  return {
    all, needsReply: active.filter(row => myBookingNeedsReply(row, userId, now)),
    visible: active.filter(row => row.date >= today && row.date <= weekEnd || bookingDisplayStatus(row, now) === 'pending' || row.reschedule?.status === 'pending' && row.reschedule.expiresAt > now)
      .sort((a, b) => Number(myBookingNeedsReply(b, userId, now)) - Number(myBookingNeedsReply(a, userId, now)) || a.startAt - b.startAt),
  };
}
/** Private, advisory overlap checks. Unconfirmed applications are not commitments. */
export function bookingConflicts(booking: ServiceBooking, bookings: ServiceBooking[], plans: SavedPlan[], outings: Outing[], userId: string): BookingConflict[] {
  if (booking.status !== 'confirmed') return [];
  const overlaps = (startAt: number, endAt: number) => booking.startAt < endAt && startAt < booking.endAt;
  const conflicts: BookingConflict[] = bookings.filter(row => row.status === 'confirmed' && [row.providerId, row.customerId].includes(userId)
    && !(row.id === booking.id && row.providerId === booking.providerId) && overlaps(row.startAt, row.endAt))
    .map(row => ({ id: `booking:${row.id}`, kind: 'booking', title: row.postTitle, href: `/me/bookings?view=${row.providerId === userId ? 'received' : 'mine'}#booking-${row.id}` }));
  for (const row of outings) if (row.status === 'open' && (row.host.id === userId || row.me?.userId === userId && row.me.status === 'confirmed' && row.me.confirmedVersion === row.planVersion)
    && overlaps(row.startAt, row.endAt)) conflicts.push({ id: `outing:${row.id}`, kind: 'outing', title: row.title, href: `/together?view=mine&outing=${encodeURIComponent(row.id)}` });
  const minute = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
  for (const plan of plans) if (plan.date === booking.date && plan.details && plan.stops.length && validClock(plan.details.startTime)) {
    const timeline = buildItinerary(plan.stops, plan.details, plan.date);
    // These are the user's saved itinerary times, not live routing estimates.
    if (timeline.rows.length && minute(booking.startTime) < timeline.end && minute(plan.details.startTime) < minute(booking.endTime))
      conflicts.push({ id: `plan:${plan.id}`, kind: 'plan', title: plan.title, href: `/plan?edit=${encodeURIComponent(plan.id)}` });
  }
  return conflicts;
}
