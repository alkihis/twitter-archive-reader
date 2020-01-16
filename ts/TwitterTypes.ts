import Conversation from "./Conversation";

/*** INTERNAL: TwitterArchive */
export interface BasicArchiveInfo {
  /** Contains informations about the user who created archive */
  user: TwitterUserDetails,
  /** Archive informations: Creation date and tweet count. */
  archive?: {
    /** Reliable only if `archive.is_gdpr === false`. */
    created_at: string,
    tweets: number
  },
}

export interface TwitterArchiveLoadOptions {
  load_images_in_zip?: boolean,
  build_ad_archive?: boolean,
}

export interface ArchiveSyntheticInfo {
  info: BasicArchiveInfo,
  is_gdpr: boolean;
  version: string;
  last_tweet_date: string;
  /** ONLY AT INFORMATIVE GOAL. MAYBE HAVE COLLISIONS ! */
  hash: string; 
  tweet_count: number;
  dm_count: number;
}

/** 
 * Raw informations stored in GDPR, extracted for a simpler use.
 * 
 * This includes list of followers, followings, mutes, blocks,
 * registered and subscribed lists, and Twitter moments.
 */
export interface ExtendedInfoContainer {
  followers: Set<string>;
  followings: Set<string>;
  mutes: Set<string>;
  blocks: Set<string>;
  lists: {
    created: string[];
    member_of: string[];
    subscribed: string[];
  };
  moments: GDPRMoment[];
}

/**
 * Link a tweet identifier to a single tweet. Tweets IDs must be **string**.
 */
export interface TweetIndex {
  [id: string]: PartialTweet;
}

/** GDPR ARCHIVE */
/**
 * One media information of a tweet in a GDPR archive.
 */
export interface MediaGDPREntity {
  /** Full URL of the media. */
  expanded_url: string;
  source_status_id: string;
  source_user_id_str: string;
  indices: [string, string];
  url: string;
  /** URL TO USE TO SHOW PICTURE */
  media_url_https: string;
  /** USE media_url_https INSTEAD */
  media_url: string;
  id_str: string;
  sizes: {
    h: string;
    w: string;
    resize: "fit" | "crop";
  }[];
  media_alt: string;
  display_url: string;
  video_info?: {
    aspect_ratio: [string, string];
    duration_millis?: string;
    variants: {
      bitrate: string;
      content_type: string;
      url: string;
    }[];
  }
  type: "photo" | "animated_gif" | "video";
}

/** A single tweet in a GPDR archive. */
export interface PartialTweetGDPR {
  source: string;
  retweeted: boolean;
  entities: {
    user_mentions: {
      name: string;
      screen_name: string;
      indices: [string, string];
      id_str: string;
    }[],
    media?: MediaGDPREntity[];
    hashtags: {
      text: string;
      indices: [string, string];
    }[];
    urls: {
      indices: [string, string];
      url: string;
      expanded_url: string;
      display_url: string;
    }[];
  };
  display_text_range: [string, string];
  favorite_count: string;
  in_reply_to_status_id_str?: string;
  id_str: string;
  in_reply_to_user_id_str?: string;
  in_reply_to_screen_name?: string;
  truncated: true;
  retweet_count: string;
  created_at: string;
  favorited: boolean;
  full_text: string;
  extended_entities?: {
    media?: MediaGDPREntity[];
  }
}

export type AccountGDPR = [{
  account: {
    email: string;
    /** Platform used to create account */
    createdVia: string;
    /** user.screen_name */
    username: string;
    /** user.id_str */
    accountId: string;
    /** user.created_at */
    createdAt: string;
    /** user.name */
    accountDisplayName: string;
  }
}];

export type ProfileGDPR = [{
  profile: {
    description: {
      /** user.description */
      bio: string;
      /** user.url */
      website: string;
      location: string;
    },
    /** user.profile_image_url_https */
    avatarMediaUrl: string;
    /** user.profile_banner_url */
    headerMediaUrl?: string;
  }
}];

export type DMFile = GDPRConversation[];

export interface GDPRConversation {
  dmConversation: {
    conversationId: string;
    messages: {
      messageCreate?: DirectMessage;
      welcomeMessageCreate?: DirectMessage;
    }[];
  }
}

export interface DirectMessage {
  /** Person who get the DM (Twitter user ID). */
  recipientId: string;
  /** Content of the DM. */
  text: string;
  /** 
   * Array of URLs linked to this direct message. 
   * Currently, a DM could only contain **one** media. 
   * 
   * To display images/medias linked in this property, use 
   * **.dmImageFromUrl()** method in the `TwitterArchive` instance.
   */
  mediaUrls: string[];
  /** Person who send the DM (Twitter user ID). */
  senderId: string;
  /** Message ID. */
  id: string;
  /** Stringified date of message creation. 
   * If the DM is a `LinkedDirectMessage`, 
   * please use **.createdAtDate** property to get the date,
   * it's already correctly parsed. 
   */
  createdAt: string;
}

export interface LinkedDirectMessage extends DirectMessage {
  /** Previous message in its conversation. `null` if this message is the first. */
  previous: LinkedDirectMessage | null;
  /** Next message in its conversation. `null` if this message is the last. */
  next: LinkedDirectMessage | null;
  createdAtDate: Date;
  /** Conversation linked to the message. This property is set if the message is in a `GlobalConversation` object. */
  conversation?: Conversation;
}

export type GDPRFollowings = {
  following: {
    accountId: string;
  }
}[];

export type GDPRFollowers = {
  follower: {
    accountId: string;
  }
}[];

export type GDPRFavorites = {
  like: PartialFavorite
}[];

export interface PartialFavorite {
  tweetId: string;
  /** Text of the favorited tweet. Defined only if archive creation > around June 2019. */
  fullText?: string;
  /** URL to the tweet. Defined only if archive creation > around June 2019. */
  expandedUrl?: string;
}

export type GDPRMutes = {
  muting: {
    accountId: string;
  }
}[];

export type GDPRBlocks = {
  blocking: {
    accountId: string;
  }
}[];

export type GDPRAgeInfo = [{
  ageMeta: InnerGDPRAgeInfo;
}];

export interface InnerGDPRAgeInfo {
  ageInfo: {
    age: string[];
    birthDate: string;
  },
  inferredAgeInfo?: {
    age: string[];
    birthDate: string;
  }
}

export interface UserAgeInfo {
  /** Can be a single age or a interval of age */
  age: number | [number, number];
  birthDate: string;
}

/**
 * Every property can be undefined, because Twitter does not provide data systematically.
 */
export interface UserFullAgeInfo extends Partial<UserAgeInfo> {
  inferred?: UserAgeInfo;
}

export interface ConnectedApplication {
  organization: {
    /** App organization name */
    name: string;
    /** App organization URL */
    url?: string;
    /** App organization privacy policy URL */
    privacyPolicyUrl?: string;
  }
  /** App name */
  name: string;
  /** App description */
  description: string;
  /** Date of application access approval */
  approvedAt: Date;
  /** OAuth permissions */
  permissions: ("read" | "write")[];
  /** Application ID */
  id: string;
  /** ?? Don't know what this thing refers to. Maybe the user who created the app (not sure at all). */
  userId?: string;
}

export interface UserEmailAddressChange {
  changedAt: Date;
  changedTo: string;
  changedFrom?: string;
}

export interface IpAudit {
  createdAt: Date;
  loginIp: string;
}

export interface PushDevice {
  deviceVersion: string;
  deviceType: string;
  token?: string;
  /** WARNING: For now (2020-01-01), this date format is "YYYY.MM.DD". This can be changed... */
  updatedDate: string;
  /** WARNING: For now (2020-01-01), this date format is "YYYY.MM.DD". This can be changed... */
  createdDate: string;
}

export interface MessagingDevice {
  deviceType: string;
  carrier: string;
  /** Phone number, prefix by +<country number> */
  phoneNumber: string;
  /** WARNING: For now (2020-01-01), this date format is "YYYY.MM.DD". This can be changed... */
  createdDate: string;
}

export type GDPRPersonalizaion = {
  p13nData: InnerGDPRPersonalization;
}[];

export interface UserPersonalization {
  demographics: {
    languages: string[];
    gender: string;
  };
  interests: {
    names: string[];
    partnerInterests: unknown[];
    advertisers: string[];
    shows: string[];
  }
}

export interface InnerGDPRPersonalization {
  demographics: {
    languages: {
      language: string;
      isDisabled: boolean;
    }[];
    genderInfo: {
      gender: string;
    }
  };
  interests: {
    interests: {
      name: string;
      isDisabled: boolean;
    }[];
    partnerInterests: unknown[];
    audienceAndAdvertisers: {
      numAudiences: string;
      advertisers: string[];
    };
    shows: string[];
  };
  locationHistory: unknown[];
  inferredAgeInfo?: {
    age: string[];
    birthDate: string;
  };
}

export interface GPDRScreenNameHistory {
  accountId: string;
  screenNameChange: ScreenNameChange;
}

export interface ScreenNameChange {
  /** When user changed its @ */
  changedAt: string;
  /** @ before the change */
  changedFrom: string;
  /** @ after the change */
  changedTo: string;
}

export interface GPDRProtectedHistory {
  protectedAt: string;
  action: "Protect" | "Unprotect";
}

/** MOMENTS */
export type GDPRMomentFile = {
  moment: GDPRMoment;
}[];

export interface GDPRMoment {
  momentId: string;
  createdAt: string;
  createdBy: string;
  title: string;
  coverMediaUrls: string[];
  tweets: GDPRTweetMoment[];
}

export interface GDPRTweetMoment {
  momentId: string;
  tweet: {
    deviceSource: {
      name: string;
      parameter: string;
      url: string;
      internalName:string;
      id: string;
      clientAppId: string;
      display: string;
    };
    urls: unknown[];
    coreData: {
      nsfwUser: boolean;
      createdVia: string;
      nsfwAdmin: boolean;
      createdAtSecs: string;
      text: string;
      conversationId: string;
      userId: string;
      hasMedia: true;
    };
    id: string;
    language: {
      language: string;
      rightToLeft: boolean;
      confidence: string;
    };
    media: GDPRMomentTweetMedia[];
    mentions: unknown[];
  }
}

export interface GDPRMomentTweetMedia {
  expandedUrl: string;
  mediaInfo: {
    imageInfo: {};
  };
  url: string;
  nsfw: boolean;
  toIndex: string;
  mediaUrl: string;
  mediaPath: string;
  displayUrl: string;
  mediaUrlHttps: string;
  mediaKey: {
    mediaCategory: MomentImageContent;
    mediaId: string;
  };
  isProtected: boolean;
  mediaId: string;
  sizes: {
    resizeMethod: MomentImageContent;
    deprecatedContentType: MomentImageContent;
    sizeType: MomentImageContent;
    height: string;
    width: string;
    faces?: {
      boundingBox: {
        left: string;
        width: string;
        top: string;
        height: string;
      };
    }[];
  }[];
}

interface MomentImageContent {
  value: string;
  name: string;
  originalName: string;
  annotations: {};
}

/** CLASSIC ARCHIVE */
/** Tweet contained in a Twitter archive. */
export interface PartialTweet {
  /** ID of the tweet. */
  id_str: string;
  /** Content of the tweet. */
  text: string;
  /** Application who created the tweet. */
  source: string;
  /** If the tweet is a reply, this is user ID of the tweet owner that this tweet replies to.  */
  in_reply_to_user_id_str?: string;
  /** If the tweet is a reply, this is user @ of the tweet owner that this tweet replies to.  */
  in_reply_to_screen_name?: string;
  /** Contain the retweeted tweet, if this tweet is a retweet. */
  retweeted_status?: PartialTweet;
  /** If the tweet is a reply, this is the tweet ID that this tweet replies to.  */
  in_reply_to_status_id_str?: string;
  /** 
   * Tweet creation date. To get the parsed date, 
   * use `dateFromTweet()` function with the tweet in parameter. 
   */
  created_at: string;
  created_at_d?: Date;
  /** User informations of the tweet. */
  user: PartialTweetUser;
  /** Medias/URLs/Mentions of this tweet. */
  entities: PartialTweetEntity;
  /** Number of retweets. */
  retweet_count?: number;
  /** Number of favorites. */
  favorite_count?: number;
  /** Entities, but with support of multiple pictures, videos and GIF. */
  extended_entities?: {
    media?: MediaGDPREntity[];
  }
}

export interface PartialTweetEntity {
  user_mentions: {
    name: string;
    screen_name: string;
    indices: [number, number];
    id_str: string;
  }[],
  media: {
    expanded_url: string;
    indices: [number, number];
    url: string;
    /** URL TO USE TO SHOW PICTURE */
    media_url_https: string;
    /** USE media_url_https INSTEAD */
    media_url: string;
    id_str: string;
    sizes: {
      h: number;
      w: number;
      resize: "fit" | "crop";
    }[];
    media_alt: string;
    display_url: string;
  }[];
  hashtags: {
    text: string;
    indices: [number, number];
  }[];
  urls: {
    indices: [number, number];
    url: string;
    expanded_url: string;
    display_url: string;
  }[];
}

export interface PartialTweetUser {
  /** User ID. */
  id_str: string;
  /** User TN. */
  name: string;
  /** User @. */
  screen_name: string;
  /** Boolean indicating if the user is protected. */
  protected: boolean;
  /** Link to its profile picture. */
  profile_image_url_https: string;
  verified?: boolean;
}

export interface ClassicPayloadDetails {
  tweets: number;
  created_at: string;
  lang: string;
}

export type ClassicTweetIndex = {
  file_name: string;
  year: number;
  tweet_count: number;
  month: number;
}[];

export interface TwitterUserDetails {
  screen_name: string;
  location: string;
  full_name: string;
  bio: string;
  id: string;
  created_at: string;
  profile_image_url_https?: string;
}


// ----------
// Ad Archive
// ----------

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
   */
  conversionTime: string;
  additionalParameters: any;
}
