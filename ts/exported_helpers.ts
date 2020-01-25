import TweetArchive from "./TweetArchive";

/**
 * Parse a raw Twitter date, like from a `dm.createdAt`.
 * 
 * For a tweet, please use `TweetArchive.dateFromTweet(tweet)` instead, it's optimized !
 * 
 * For a `LinkedDirectMessage`, use property `.createdAtDate` !
 */
export const parseTwitterDate = TweetArchive.parseTwitterDate;
