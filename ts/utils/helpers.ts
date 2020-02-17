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

/**
 * Safe push a possibily huge number of elements in array.
 */
export function safePusher<T>(array: Array<T>, elements: Array<T>) {
  // Some engines does not like the splat operators with 50000 elements in
  // parameter, need to do some tricks to work it on
  const CHUNK_LEN = 50000;
  if (elements.length > CHUNK_LEN) {
    let i = 0;

    let chunk = elements.slice(i, i + CHUNK_LEN);
    while (chunk.length) {
      array.push(...chunk);
      chunk = elements.slice(i, i + CHUNK_LEN);
      i += CHUNK_LEN;
    }
  }
  else {
    array.push(...elements);
  }
}
