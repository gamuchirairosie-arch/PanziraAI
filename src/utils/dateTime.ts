const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export interface DateTimeValidationResult {
  valid: boolean;
  date?: Date;
  normalizedReadable?: string;
  isoString?: string;
  shortTime?: string;
  error?: string;
}

/**
 * Formats a Date into `YYYY-MM-DDTHH:mm` in local browser time for `<input type="datetime-local">`.
 */
export function toLocalDateTimeInputValue(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formats a Date into a consistent human-readable string across Panzira AI, e.g. `4 Nov 2026, 03:20`.
 */
export function formatReadableDateTime(date: Date): string {
  const day = date.getDate();
  const month = MONTHS_SHORT[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

/**
 * Formats a Date into `HH:mm`.
 */
export function formatShortTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function daysInCalendarMonth(year: number, month1Based: number): number {
  return new Date(year, month1Based, 0).getDate();
}

/**
 * Strictly validates an observed hazard date/time input.
 * Rejects empty values, malformed strings (e.g. "not-a-date"), impossible calendar dates
 * (e.g. Feb 30), implausibly old dates (< 2020), and future timestamps.
 */
export function validateObservedDateTime(
  rawInput: string,
  referenceNow: Date = new Date()
): DateTimeValidationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Please enter the date and time when you observed the hazard.',
    };
  }

  // Primary format from <input type="datetime-local">: YYYY-MM-DDTHH:mm(:ss)?
  const isoLocalMatch = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);

  let parsedDate: Date | null = null;

  if (isoLocalMatch) {
    const year = Number(isoLocalMatch[1]);
    const month = Number(isoLocalMatch[2]);
    const day = Number(isoLocalMatch[3]);
    const hour = Number(isoLocalMatch[4]);
    const minute = Number(isoLocalMatch[5]);
    const second = isoLocalMatch[6] ? Number(isoLocalMatch[6]) : 0;

    if (month < 1 || month > 12) {
      return {
        valid: false,
        error: 'Enter a valid calendar month (01–12).',
      };
    }

    const maxDay = daysInCalendarMonth(year, month);
    if (day < 1 || day > maxDay) {
      return {
        valid: false,
        error: `Enter a valid calendar day (1–${maxDay}) for the selected month.`,
      };
    }

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
      return {
        valid: false,
        error: 'Enter a valid 24-hour time (00:00–23:59).',
      };
    }

    parsedDate = new Date(year, month - 1, day, hour, minute, second, 0);
  } else {
    // Reject loose arbitrary strings unless they match strict `D MMM YYYY, HH:mm`
    const readableMatch =
      /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4}),?\s+(\d{2}):(\d{2})$/i.exec(
        trimmed
      );
    if (!readableMatch) {
      return {
        valid: false,
        error:
          'Enter a valid date and time using the date-time picker (for example, 2026-11-04 08:30).',
      };
    }
    const day = Number(readableMatch[1]);
    const monthIdx = MONTHS_SHORT.findIndex(
      (m) => m.toLowerCase() === readableMatch[2].toLowerCase()
    );
    const year = Number(readableMatch[3]);
    const hour = Number(readableMatch[4]);
    const minute = Number(readableMatch[5]);

    const maxDay = daysInCalendarMonth(year, monthIdx + 1);
    if (monthIdx < 0 || day < 1 || day > maxDay || hour > 23 || minute > 59) {
      return {
        valid: false,
        error: 'The date or time entered is not a valid calendar timestamp.',
      };
    }
    parsedDate = new Date(year, monthIdx, day, hour, minute, 0, 0);
  }

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return {
      valid: false,
      error: 'Enter a valid observed date and time.',
    };
  }

  if (parsedDate.getFullYear() < 2020) {
    return {
      valid: false,
      error: 'Observed date cannot be earlier than 2020. Please enter a recent observation time.',
    };
  }

  // Allow up to 59 seconds grace for minute-precision inputs when current seconds are < 59,
  // while strictly rejecting future minutes, hours, days, or years.
  const endOfCurrentMinute = new Date(referenceNow);
  endOfCurrentMinute.setSeconds(59, 999);

  if (parsedDate.getTime() > endOfCurrentMinute.getTime()) {
    return {
      valid: false,
      error: 'Observed date and time cannot be in the future.',
    };
  }

  return {
    valid: true,
    date: parsedDate,
    normalizedReadable: formatReadableDateTime(parsedDate),
    isoString: parsedDate.toISOString(),
    shortTime: formatShortTime(parsedDate),
  };
}

