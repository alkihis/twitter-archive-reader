import { MediaGDPREntity } from "./GDPRTweets";

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
   * use `TwitterHelpers.dateFromTweet()` function with the tweet in parameter. 
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

  /** Defined if archive type is GDPR. */
  retweeted?: boolean;
  /** 
   * Defined if archive type is GDPR. 
   * Should usually define tweet text boundaries, without the leading(s) @.
   * 
   * This is **NOT** accurate, Twitter set it inproperly in archives:
   * First element of array is always `"0"`, which makes this property useless.
   */
  display_text_range?: [string, string];
  /** Defined if archive type is GDPR. */
  truncated?: boolean;
  /** Defined if archive type is GDPR. */
  favorited?: boolean;
  /** Defined if archive type is GDPR. */
  full_text?: string;
}

export interface PartialTweetMediaEntity {
  expanded_url: string;
  indices: [number, number];
  url: string;
  /** Use this URL to show pictures. */
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
}

export interface PartialTweetEntity {
  user_mentions: {
    name: string;
    screen_name: string;
    indices: [number, number];
    id_str: string;
  }[],
  media: PartialTweetMediaEntity[];
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

export interface TwitterUserDetails {
  /** User @ */
  screen_name: string;
  /** Location registered on profile */
  location: string;
  /** Twitter Name (display name) */
  full_name: string;
  /** Biography */
  bio: string;
  /** User ID */
  id: string;
  /** Account creation date (stringified). Should be parsed with `TwitterHelpers.parseTwitterDate()`. */
  created_at: string;
  /** Profile image. Available if `archive.is_gpdr === true`. */
  profile_image_url_https?: string;
  /** URL registered on profile. Available if `archive.is_gpdr === true`. */
  url?: string;
  /** Profile banner. Available if `archive.is_gpdr === true` and if archive owner had a banner. */
  profile_banner_url?: string;
}
