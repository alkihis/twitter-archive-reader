import { supportsBigInt } from "./helpers";
import bigInt from 'big-integer';
import { LinkedDirectMessage, DirectMessageEventContainer, DirectMessageEventsContainer, DirectMessageEvent } from "../types/GDPRDMs";
import { PartialTweet } from "../types/ClassicTweets";
import { PartialTweetGDPR } from "../types/GDPRTweets";
import { PartialFavorite } from "../types/GDPRExtended";
import twitterSnowflakeToDate from "twitter-snowflake-to-date";

// -------------------------
// - ABOUT DIRECT MESSAGES -
// -------------------------

/**
 * Iterates over events inside direct messages.
 *
 * If you want messages events to be iterated, set {include_messages} to `true`.
 */
export function* getEventsFromMessages(
  msgs: LinkedDirectMessage[],
  include_messages = false,
  remove_double_linked_list = false,
) : Generator<DirectMessageEventContainer, void, void> {
  function* addEvents(e: DirectMessageEventsContainer) {
    const all_events: [string, DirectMessageEvent][] = [];

    for (const [key, events] of Object.entries(e)) {
      all_events.push(...events.map((e: DirectMessageEvent) => [key, e]));
    }

    const sorted = all_events.sort((a, b) => a[1].createdAtDate.getTime() - b[1].createdAtDate.getTime());
    for (const [type, ev] of sorted) {
      yield { [type]: ev };
    }
  }

  let first = true;
  for (let msg of msgs) {
    if (first) {
      first = false;
      if (msg.events && msg.events.before) {
        yield* addEvents(msg.events.before);
      }
    }

    if (include_messages) {
      if (remove_double_linked_list) {
        msg = { ...msg };
        delete msg.next;
        delete msg.previous;
      }

      yield { messageCreate: msg };
    }

    if (msg.events && msg.events.after) {
      yield* addEvents(msg.events.after);
    }
  }
}


// ---------------
// - ABOUT DATES -
// ---------------

/**
 * Parse a raw date found in `AdImpression.impressionTime` or `AdEngagementAttribute.engagementTime`.
 *
 * Should not be used to parse another Twitter Archive date.
 */
export function parseAdDate(date: string) : Date {
  return new Date(date.split(" ", 2).join("T") + ".000Z");
}

/**
 * Parse a raw Twitter date, from a `dm.createdAt` or `tweet.created_at`.
 *
 * For a tweet, please use `TwitterHelpers.dateFromTweet(tweet)` instead, it's optimized !
 *
 * For dates in ad data (everthing that comes from `AdArchive`), use instead `TwitterHelpers.parseAdDate()` !
 *
 * For a `LinkedDirectMessage`, use property `.createdAtDate` !
 */
export function parseTwitterDate(date: string) : Date {
  try {
    const d = new Date(date);

    if (isNaN(d.getTime())) {
      throw "";
    }
    else {
      return d;
    }
  } catch (e) {
    return new Date(date.replace(/\s(.+)\s.+/, 'T$1.000Z'));
  }
}

/** Return the `Date` object affiliated to **tweet**. */
export function dateFromTweet(tweet: PartialTweet) : Date {
  if (tweet.created_at_d && tweet.created_at_d instanceof Date) {
    return tweet.created_at_d;
  }
  return tweet.created_at_d = parseTwitterDate(tweet.created_at);
}

/** Return the `Date` object affiliated to **favorite**. */
export function dateFromFavorite(favorite: PartialFavorite) : Date {
  if (favorite.date && favorite.date instanceof Date) {
    return favorite.date;
  }
  return favorite.date = twitterSnowflakeToDate(favorite.tweetId);
}

/**
 * Parse a date inside a `PushDevice` or a `MessagingDevice` object.
 *
 * Should not be used for any other type of object !
 */
export function parseDeviceDate(date: string) {
  try {
    const d = new Date(date);

    // Chrome can parse YYYY.MM.DD correctly...
    if (!isNaN(d.getTime())) {
      return d;
    }
  } catch (e) { }

  return new Date(date.replace(/\./g, '-'));
}


// ----------------
// - ABOUT TWEETS -
// ----------------

/**
 * Sort tweets by ID (descending order by default).
 */
export function sortTweets<T extends { id_str: string }>(tweets: T[], order: "asc" | "desc" = "desc") {
  let sort_fn: (a: T, b: T) => number;

  if (supportsBigInt()) {
    if (order === "asc")
      sort_fn = (a, b) => Number(BigInt(a.id_str) - BigInt(b.id_str));
    else
      sort_fn = (a, b) => Number(BigInt(b.id_str) - BigInt(a.id_str));
  }
  else {
    if (order === "asc")
      sort_fn = (a, b) => (bigInt(a.id_str).minus(bigInt(b.id_str))).toJSNumber();
    else
      sort_fn = (a, b) => (bigInt(b.id_str).minus(bigInt(a.id_str))).toJSNumber();
  }

  return tweets.sort(sort_fn);
}

/**
 * Sort favorites by ID (descending order by default).
 */
export function sortFavorites(favorites: PartialFavorite[], order: "asc" | "desc" = "desc") {
  let sort_fn: (a: PartialFavorite, b: PartialFavorite) => number;

  if (supportsBigInt()) {
    if (order === "asc")
      sort_fn = (a, b) => Number(BigInt(a.tweetId) - BigInt(b.tweetId));
    else
      sort_fn = (a, b) => Number(BigInt(b.tweetId) - BigInt(a.tweetId));
  }
  else {
    if (order === "asc")
      sort_fn = (a, b) => (bigInt(a.tweetId).minus(bigInt(b.tweetId))).toJSNumber();
    else
      sort_fn = (a, b) => (bigInt(b.tweetId).minus(bigInt(a.tweetId))).toJSNumber();
  }

  return favorites.sort(sort_fn);
}

/**
 * True if given tweet is coming from a GDPR archive.
 *
 * Tweets getted by available getters are NOT GDPR tweets, they've been converted !
 */
export function isGDPRTweet(tweet: PartialTweetGDPR | PartialTweet) : tweet is PartialTweetGDPR {
  return 'retweet_count' in tweet;
}

/**
 * Return true if **tweet** contains media(s).
 *
 * This includes photos, videos or animated GIF.
 */
export function isWithMedia(tweet: PartialTweet) {
  return !!tweet.entities.media?.length;
}

/**
 * Return true if **tweet** contains a video or one animated GIF.
 *
 * Twitter's GIF are mp4 encoded.
 */
export function isWithVideo(tweet: PartialTweet) {
  if (tweet.extended_entities) {
    if (tweet.extended_entities.media) {
      return tweet.extended_entities.media.some(m => m.type !== "photo");
    }
  }

  return false;
}
