/*** INTERNAL: TwitterArchive */
export interface ArchiveIndex {
  info: TwitterUserDetails,
  years: {
    [year: string]: {
      [month: string]: TweetIndex;
    }
  },
  archive: {
    created_at: string,
    tweets: number
  },
  by_id: TweetIndex
}

export interface TweetIndex {
  [id: string]: PartialTweet;
}

/** GDPR ARCHIVE */
export interface MediaGDPREntity {
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
  recipientId: string;
  text: string;
  mediaUrls: string[];
  senderId: string;
  id: string;
  createdAt: string;
}

export interface LinkedDirectMessage extends DirectMessage {
  previous: LinkedDirectMessage | null;
  next: LinkedDirectMessage | null;
  createdAtDate: Date;
}

/** CLASSIC ARCHIVE */
export interface PartialTweet {
  id_str: string;
  text: string;
  source: string;
  in_reply_to_user_id_str?: string;
  in_reply_to_screen_name?: string;
  retweeted_status?: PartialTweet;
  in_reply_to_status_id_str?: string;
  created_at: string;
  created_at_d?: Date;
  user: PartialTweetUser;
  entities: {
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
  };
  extended_entities?: {
    media?: MediaGDPREntity[];
  }
}

export interface PartialTweetUser {
  id_str: string;
  name: string;
  screen_name: string;
  protected: boolean;
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
}