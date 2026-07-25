import type { FieldErrors } from '../types/forms';

export function cleanText(value: string) {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function isPhone(value: string) {
  return /^\d{10,20}$/.test(value);
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && value === parsed.toISOString().slice(0, 10);
}

export function isTodayOrFuture(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsed = new Date(`${value}T00:00:00`);
  return parsed.getTime() >= today.getTime();
}

export function isHour(value: string) {
  if (!value) return true;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function mergeServerErrors<T extends string>(error: unknown, fallback: string): { message: string; errors: FieldErrors<T> } {
  if (error instanceof Error) {
    const maybe = error as Error & { errors?: FieldErrors<T> };
    return { message: error.message || fallback, errors: maybe.errors ?? {} };
  }
  return { message: fallback, errors: {} };
}
