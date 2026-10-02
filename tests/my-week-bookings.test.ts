import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingConflicts, selectMyWeekBookings } from '../src/features/bookings/my-week-bookings-model';
import { parseBooking, type ServiceBooking, type ServiceBookingInbox } from '../src/lib/service-bookings';
import type { Outing } from '../src/lib/outings';
import type { SavedPlan } from '../src/lib/planner';
import { defaultPlanDetails } from '../src/lib/planner-itinerary';
import { PLANNER_PLACES } from '../src/data/planner-catalog';

const now = Date.parse('2026-10-01T17:00:00Z');
const booking: ServiceBooking = { id: 'booking', postId: 'cleaning', providerId: 'provider', customerId: 'me', providerName: 'Provider', customerName: 'Me', postTitle: 'Cleaning', date: '2026-10-03', startTime: '10:00', endTime: '11:00', startAt: Date.parse('2026-10-03T17:00:00Z'), endAt: Date.parse('2026-10-03T18:00:00Z'), timezone: 'America/Los_Angeles', status: 'confirmed', note: '', createdAt: now, updatedAt: now, bufferMinutes: 30 };
const inbox = (rows: ServiceBooking[]): ServiceBookingInbox => ({ asCustomer: rows, asProvider: [], sms: { enabled: false, configured: false, eligible: false } });
test('week bookings use Pacific days, include later pending tasks, and omit terminal, expired and foreign bookings', () => {
  const late = { ...booking, id: 'late', date: '2026-10-20', startAt: Date.parse('2026-10-20T17:00:00Z'), endAt: Date.parse('2026-10-20T18:00:00Z') };
  const selection = selectMyWeekBookings(inbox([booking, late, { ...late, id: 'pending', status: 'pending', expiresAt: now + 1000 }, { ...booking, id: 'cancelled', status: 'cancelled' }, { ...booking, id: 'expired', status: 'pending', expiresAt: now - 1 }, { ...booking, id: 'foreign', customerId: 'other' }]), 'me', now);
  assert.deepEqual(selection.visible.map(row => row.id), ['booking', 'pending']); assert.equal(selection.needsReply.length, 0);
  const received = { ...late, id: 'received', customerId: 'other', providerId: 'me', status: 'pending' as const, expiresAt: now + 1000 };
  assert.equal(selectMyWeekBookings({ ...inbox([]), asProvider: [received] }, 'me', now).needsReply.length, 1);
});
test('overlap checks require actual commitments, exclude adjacent times, and use saved itinerary times', () => {
  const group = { id: 'group', title: 'Coffee', host: { id: 'other' }, me: { userId: 'me', status: 'confirmed', confirmedVersion: 1 }, planVersion: 1, status: 'open', startAt: booking.startAt, endAt: booking.endAt } as Outing;
  const plan: SavedPlan = { id: 'plan', title: 'Morning', date: booking.date, stops: [{ kind: 'place', id: PLANNER_PLACES[0].id }], details: { ...defaultPlanDetails(), startTime: '10:00' }, createdAt: '', updatedAt: '', version: 1 };
  const rows = [booking, { ...booking, id: 'other', providerId: 'second' }, { ...booking, id: 'pending', status: 'pending' as const }, { ...booking, id: 'adjacent', startAt: booking.endAt, endAt: booking.endAt + 3600000 }];
  assert.deepEqual(bookingConflicts(booking, rows, [plan], [group, { ...group, id: 'unconfirmed', planVersion: 2 }, { ...group, id: 'requested', me: { ...group.me!, status: 'requested' } }], 'me').map(row => row.id), ['booking:other', 'outing:group', 'plan:plan']);
  assert.deepEqual(bookingConflicts({ ...booking, status: 'pending' }, rows, [plan], [group], 'me'), []);
});
test('reschedule parsing rejects forged participants and impossible wall-clock time', () => {
  const proposal = { id: 'p', slotId: 's', proposedBy: 'provider', status: 'pending', date: booking.date, startTime: booking.startTime, endTime: booking.endTime, startAt: booking.startAt, endAt: booking.endAt, createdAt: now, expiresAt: now + 3600000 };
  assert.equal(parseBooking({ ...booking, reschedule: proposal }).reschedule?.id, 'p');
  assert.throws(() => parseBooking({ ...booking, reschedule: { ...proposal, proposedBy: 'stranger' } }));
  assert.throws(() => parseBooking({ ...booking, reschedule: { ...proposal, startAt: 0 } }));
});
