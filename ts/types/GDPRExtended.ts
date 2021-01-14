/*
 * Per file entity (type used to read files)
 */

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


/*
 * Favorites
 */

export interface PartialFavorite {
  tweetId: string;
  /** Text of the favorited tweet. Defined only if archive creation > around June 2019. */
  fullText?: string;
  /** URL to the tweet. Defined only if archive creation > around June 2019. */
  expandedUrl?: string;
  /** Internal date. */
  date?: Date;
}
