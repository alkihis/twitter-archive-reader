import { AdImpression, AdEngagement, AdMobileConversion, AdOnlineConversion } from "../types/GDPRAds";

/**
 * Twitter collected data about ads viewed and interacted with by the archive owner.
 */
export class AdArchive {
  /**
   * Collected data about ads viewed by archive owner.
   */
  impressions: AdImpression[] = [];
  /**
   * Collected data about ads archive owner have interacted with.
   */
  engagements: AdEngagement[] = [];
  /**
   * Mobile application events associated with archive owner account in the last 90 days 
   * which are attributable to a Promoted Tweet engagement on Twitter.
   * 
   * Ads which archive owner might have seen **on mobile app** and "converted" to real action:
   * 
   * For example: Installed an application, used an app targeted by a ad...
   */
  mobile_conversions: AdMobileConversion[] = [];
  /**
   * All online (website) activities associated with archive owner account in the last 90 days via advertiser 
   * website integrations which are attributable to a Promoted Tweet engagement on Twitter.
   * 
   * Ads which archive owner might have seen **on desktop website** and "converted" to real action:
   * 
   * For example: Clicked on the ad and see a webpage...
   */
  online_conversions: AdOnlineConversion[] = [];

  /**
   * Impressions by display location (where archive owner seen it on Twitter environnement: Timeline, profile...)
   */
  get impressions_by_location() {
    const impressions: { [location: string]: AdImpression[] } = {};
    
    for (const impression of this.impressions) {
      if (impression.displayLocation in impressions) {
        impressions[impression.displayLocation].push(impression);
      }
      else {
        impressions[impression.displayLocation] = [impression];
      }
    }

    return impressions;
  }

  /**
   * Impressions by advertiser screen name (with @ in it).
   * 
   * Real advertiser name can be obtains with `impression.advertiserInfo.advertiserName`.
   */
  get impressions_by_advertiser() {
    const impressions: { [advertiser: string]: AdImpression[] } = {};
    
    for (const impression of this.impressions) {
      if (impression.advertiserInfo.screenName in impressions) {
        impressions[impression.advertiserInfo.screenName].push(impression);
      }
      else {
        impressions[impression.advertiserInfo.screenName] = [impression];
      }
    }

    return impressions;
  }

  /**
   * All impressions linked to an engagement, sorted by engagement types.
   * 
   * A single impression can have multiple engagement types.
   */
  get impressions_by_engagement_type() {
    const impressions: { [engagementType: string]: AdImpression[] } = {};

    for (const engagement of this.engagements) {
      for (const e of engagement.engagementAttributes) {
        if (e.engagementType in impressions) {
          impressions[e.engagementType].push(engagement.impressionAttributes);
        }
        else {
          impressions[e.engagementType] = [engagement.impressionAttributes];
        }
      }
    }

    return impressions;
  }
}

export default AdArchive;
