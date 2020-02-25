import { parseTwitterDate } from "./exported_helpers";
import { BaseArchive } from "../reading/StreamArchive";
import { AdImpressionFile, AdEngagementFile, AdMobileConversionsFile, AdOnlineConversionsFile } from "../types/GDPRAds";
import AdArchive from "../user/AdArchive";

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

export async function initAdArchiveFromArchive(archive: BaseArchive<any>, ads: AdArchive) {
  try {
    const impressions = await archive.get('ad-impressions.js') as AdImpressionFile;
    for (const i of impressions) {
      ads.impressions.push(...i.ad.adsUserData.adImpressions.impressions);
    }
  } catch (e) { }

  try {
    const engagements = await archive.get('ad-engagements.js') as AdEngagementFile;
    for (const e of engagements) {
      ads.engagements.push(...e.ad.adsUserData.adEngagements.engagements);
      ads.impressions.push(...e.ad.adsUserData.adEngagements.engagements.map(e => e.impressionAttributes));
    }
  } catch (e) { }

  try {
    const ads_mobile = await archive.get('ad-mobile-conversions-attributed.js') as AdMobileConversionsFile;
    for (const ad of ads_mobile) {
      ads.mobile_conversions.push(...ad.ad.adsUserData.attributedMobileAppConversions.conversions);
    }
  } catch (e) { }

  try {
    const ads_online = await archive.get('ad-online-conversions-attributed.js') as AdOnlineConversionsFile;
    for (const ad of ads_online) {
      ads.online_conversions.push(...ad.ad.adsUserData.attributedOnlineConversions.conversions);
    }
  } catch (e) { }
}
