
/* ENGAGEMENTS AND IMPRESSIONS */
/* --------------------------- */

// ad-engagements.js
export interface RawAdEngagementObject {
  ad: {
    adsUserData: {
      adEngagements: {
        engagements: AdEngagement[];
      }
    }
  }
}
export type AdEngagementFile = RawAdEngagementObject[];

// ad-impressions.js
export interface RawAdImpressionObject {
  ad: {
    adsUserData: {
      adImpressions: {
        impressions: AdImpression[];
      }
    }
  }
}
export type AdImpressionFile = RawAdImpressionObject[];

export interface AdImpression {
  deviceInfo: AdDeviceInfo;
  /** Type list might not be exhaustive. */
  displayLocation: "TimelineHome" | "ProfileAccountsSidebar" | "SearchTweets" | "OrganicVideo" | "ProfileTweets" | "ClusterFollow";
  /** Is rarely undefined. */
  promotedTweetInfo?: AdPromotedTweet;
  promotedTrendInfo?: AdPromotedTrend;
  advertiserInfo: AdAdvertiserInfo;
  publisherInfo?: AdPublisherInfo;
  matchedTargetingCriteria: AdMatchedCriteria[];
  rtbCreativeMediaInfo?: AdCreativeMediaInfo;
  /**
   * Time, but in special format: `YYYY-MM-DD HH:mm:ss`
   *
   * V8 (Chrome/Node) might parse it correctly with `Date()`,
   * but Firefox or Safari will fail (you need to convert it to a ISO date by adding timezone).
   *
   * Parse it with `TwitterHelpers.parseAdDate()`.
   */
  impressionTime: string;
}

export interface AdCreativeMediaInfo {
  /** Type list might not be exhaustive. */
  mediaType: "LinearPreroll";
}

export interface AdPromotedTweet {
  tweetId: string;
  tweetText: string;
  urls: string[];
  mediaUrls: string[];
}

export interface AdPromotedTrend {
  trendId: string;
  name: string;
  description: string;
}

export interface AdAdvertiserInfo {
  advertiserName: string;
  /** Warning: Contains the @ ! */
  screenName: string;
}

export interface AdPublisherInfo {
  publisherName: string;
  /** With starting @ */
  screenName: string;
}

export interface AdMatchedCriteria {
  targetingType: "Follower look-alikes" | "Age" | "Locations" | "Platforms" | "Gender" | "Keywords" | 
  "Retargeting campaign engager" | "Retargeting engagement type" | "Conversation topics" | "Events" |
  "Interests";
  /**
   * Format is determined from `.targetingType`:
   *
   * `Follower look-alikes`: One screen name (with the @) `"@<screenName>"`
   *
   * `Age`: Age range `"<number> to <number>"`
   *
   * `Locations`: string location. Could be country or town, free format
   *
   * `Platforms`: User device platform, ex: `"Android"`
   *
   * `Gender`: Ex. `"Male"`.
   *
   * `Keywords`: Free text.
   *
   * `Retargeting campaign engager`: Target campaign ID, odd format: `"Retargeting campaign engager: <number>"`
   *
   * `Retargeting engagement type`: Type ID, odd format: `"Retargeting engagement type: <number>"`
   *
   * `Conversation topics`: free text
   *
   * `Events`: free text
   *
   * `Interests`: free text
   */
  targetingValue: string;
}

export interface AdEngagementAttribute {
  /**
   * Time, but in special format: `YYYY-MM-DD HH:mm:ss`
   *
   * V8 (Chrome/Node) might parse it correctly with `Date()`,
   * but Firefox or Safari will fail (you need to convert it to a ISO date by adding timezone).
   *
   * Parse it with `TwitterHelpers.parseAdDate()`.
   */
  engagementTime: string;
  engagementType: "VideoSession" | "VideoContentPlaybackStart" | "VideoContentMrcView" |
    "VideoContent6secView" | "VideoContentPlaybackComplete" | "VideoContentPlayback95" |
    "VideoContentPlayback75" | "VideoContentPlayback50" | "VideoContentPlayback25" |
    "VideoAdPlaybackStart" | "VideoAdPlayback50" | "VideoAdMrcView" | "VideoAd1secView" |
    "VideoAdPlayback25" | "VideoAdPlayback75" | "VideoAdPlayback95" | "VideoContent1secView" |
    "VideoContentViewV2" | "VideoAdViewV2" | "VideoAdView" | "VideoAdViewThreshold" |
    "PollCardVote" | "Detail";
}

/**
 * Each engagement contains a single impression, and contains multiples engagements types.
 */
export interface AdEngagement {
  impressionAttributes: AdImpression;
  engagementAttributes: AdEngagementAttribute[];
}

export interface AdDeviceInfo {
  osType: string;
  deviceId: string;
}


/* CONVERSIONS */
/* ----------- */

// ad-mobile-conversions-attributed.js
export interface RawAdMobileConversionsObject {
  ad: {
    adsUserData: {
      attributedMobileAppConversions: {
        conversions: AdMobileConversion[];
      }
    }
  }
}
export type AdMobileConversionsFile = RawAdMobileConversionsObject[];

export interface AdMobileConversion {
  /** Ex: `"ReEngage"`, `"PageView"`... */
  attributedConversionType: string;
  mobilePlatform: string;
  conversionEvent: string;
  applicationName: string;
  conversionValue: string;
  /**
   * Time, but in special format: `YYYY-MM-DD HH:mm:ss`
   *
   * V8 (Chrome/Node) might parse it correctly with `Date()`,
   * but Firefox or Safari will fail (you need to convert it to a ISO date by adding timezone).
   *
   * Use `TwitterHelpers.parseAdDate()` to parse it correctly.
   */
  conversionTime: string;
}

// ad-online-conversions-attributed.js
export interface RawAdOnlineConversionsObject {
  ad: {
    adsUserData: {
      attributedOnlineConversions: {
        conversions: AdOnlineConversion[];
      }
    }
  }
}
export type AdOnlineConversionsFile = RawAdOnlineConversionsObject[];

export interface AdOnlineConversion {
  /** Ex: `"ReEngage"`, `"PageView"`... */
  attributedConversionType: string;
  eventType: string;
  conversionPlatform: string;
  conversionUrl: string;
  advertiserInfo: AdAdvertiserInfo;
  conversionValue: string;
  /**
   * Time, but in special format: `YYYY-MM-DD HH:mm:ss`
   *
   * V8 (Chrome/Node) might parse it correctly with `Date()`,
   * but Firefox or Safari will fail (you need to convert it to a ISO date by adding timezone).
   *
   * Use `TwitterHelpers.parseAdDate()` to parse it correctly.
   */
  conversionTime: string;
  additionalParameters: any;
}
