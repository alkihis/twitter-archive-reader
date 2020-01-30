import { TwitterUserDetails, PartialTweet } from "./ClassicTweets";
import { GDPRMoment } from "./GDPRMoments";

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
