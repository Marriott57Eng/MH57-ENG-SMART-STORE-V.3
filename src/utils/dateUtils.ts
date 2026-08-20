/**
 * Date and Time utilities formatted for Thailand (Bangkok UTC+7)
 */

export function formatRecordTimestamp(timestamp?: string, isoDate?: string): string {
  // If timestamp already has Thai month or formatted text, return it directly to preserve exact user selection
  if (
    timestamp &&
    (timestamp.includes('น.') ||
      timestamp.includes('ม.ค.') ||
      timestamp.includes('ก.พ.') ||
      timestamp.includes('มี.ค.') ||
      timestamp.includes('เม.ย.') ||
      timestamp.includes('พ.ค.') ||
      timestamp.includes('มิ.ย.') ||
      timestamp.includes('ก.ค.') ||
      timestamp.includes('ส.ค.') ||
      timestamp.includes('ก.ย.') ||
      timestamp.includes('ต.ค.') ||
      timestamp.includes('พ.ย.') ||
      timestamp.includes('ธ.ค.'))
  ) {
    return timestamp;
  }

  // If isoDate exists, it holds the precise UTC timestamp, convert to Bangkok timezone
  if (isoDate) {
    try {
      const d = new Date(isoDate);
      if (!isNaN(d.getTime())) {
        return (
          d.toLocaleString('th-TH', {
            timeZone: 'Asia/Bangkok',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }) + ' น.'
        );
      }
    } catch {}
  }

  // If timestamp exists and can be parsed as a date
  if (timestamp) {
    try {
      const d = new Date(timestamp);
      if (!isNaN(d.getTime()) && timestamp.includes('-') && timestamp.includes(':')) {
        return (
          d.toLocaleString('th-TH', {
            timeZone: 'Asia/Bangkok',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }) + ' น.'
        );
      }
    } catch {}
    return timestamp;
  }

  return '';
}

export function getBangkokTimestamp(): string {
  return (
    new Date().toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + ' น.'
  );
}

