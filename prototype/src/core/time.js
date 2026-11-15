/**
 * Date / schedule helpers shared by the business and presentation layers.
 * AUBH's teaching week runs Sunday to Thursday.
 */
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const TEACHING_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

/** Availability slots used by the tutor availability grid (Figma: Tutor - Availability). */
export const SLOTS = Object.freeze({
  morning: { label: 'Morning', range: '8 AM–12 PM', startHour: 8, endHour: 12, requestHour: 10, requestMinute: 0 },
  afternoon: { label: 'Afternoon', range: '12–4 PM', startHour: 12, endHour: 16, requestHour: 14, requestMinute: 0 },
  evening: { label: 'Evening', range: '4–8 PM', startHour: 16, endHour: 20, requestHour: 17, requestMinute: 0 },
});

export function slotOfTime(hhmm) {
  const hour = Number(String(hhmm).split(':')[0]);
  if (hour < 12) return 'morning';
  if (hour < 16) return 'afternoon';
  return 'evening';
}

export function formatClock(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatDays(days) {
  return days.join(' & ');
}

/** "Tue & Thu · 3:30–5:00 PM" */
export function formatSchedule(schedule) {
  return `${formatDays(schedule.days)} · ${formatClock(schedule.start)}–${formatClock(schedule.end)}`;
}

/** "Mon, Nov 16" */
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Nov 10" */
export function formatShortDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Nov 10, 2026" */
export function formatLongDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Mon, Nov 16 · 2:00 PM" */
export function formatDateTime(iso) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${formatDate(iso)} · ${time}`;
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Next `count` dates (from `from`) on which a weekly schedule meets.
 * Returns ISO strings for the start time of each meeting.
 */
export function nextOccurrences(schedule, count = 3, from = new Date()) {
  const [h, m] = schedule.start.split(':').map(Number);
  const result = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60 && result.length < count; i++) {
    const day = DAYS[cursor.getDay()];
    if (schedule.days.includes(day)) {
      const start = new Date(cursor);
      start.setHours(h, m, 0, 0);
      if (start > from) result.push(start.toISOString());
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

/** Date of the next `dayName` at hh:mm, `weeksAhead` weeks later. */
export function nextWeekday(dayName, hour, minute = 0, from = new Date(), weeksAhead = 0) {
  const target = DAYS.indexOf(dayName);
  const d = new Date(from);
  d.setHours(hour, minute, 0, 0);
  let diff = (target - d.getDay() + 7) % 7;
  if (diff === 0 && d <= from) diff = 7;
  d.setDate(d.getDate() + diff + weeksAhead * 7);
  return d.toISOString();
}

export function daysAgo(n, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
