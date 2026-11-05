/**
 * Unified Date Formatting Utilities for TalkWithMe
 * Strict requirement: All dates must be formatted as dd/mm/yyyy (or dd/mm/yyyy HH:mm when time is included).
 */

export function formatDDMMYYYY(dateVal: string | number | Date | null | undefined): string {
  if (!dateVal) return '';

  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    // Already in dd/mm/yyyy format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }
    // Relative mock labels
    if (trimmed.includes('Hôm nay') || trimmed.includes('Hôm qua') || trimmed.includes('ngày trước')) {
      return trimmed;
    }
  }

  const d = new Date(dateVal);
  if (isNaN(d.getTime())) {
    return typeof dateVal === 'string' ? dateVal : '';
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

export function formatDateTimeDDMMYYYY(dateVal: string | number | Date | null | undefined): string {
  if (!dateVal) return '';

  const d = new Date(dateVal);
  if (isNaN(d.getTime())) {
    return typeof dateVal === 'string' ? dateVal : '';
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
