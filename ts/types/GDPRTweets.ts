
/** A single tweet in a GPDR archive. */
export interface PartialTweetGDPR {
  /** Occurs during parsing time. */
  tweet?: PartialTweetGDPR;
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


