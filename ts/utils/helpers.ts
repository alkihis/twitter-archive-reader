import { parseTwitterDate } from "./exported_helpers";

export function supportsBigInt() {
  return typeof BigInt !== 'undefined';
}

export function dateOfDMEvent(event: { createdAt: string, createdAtDate?: Date }) {
  if (event.createdAtDate instanceof Date) {
    return event.createdAtDate;
  }
  return event.createdAtDate = parseTwitterDate(event.createdAt);
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
