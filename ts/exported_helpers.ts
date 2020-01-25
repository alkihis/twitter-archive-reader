import TweetArchive from "./TweetArchive";
import { LinkedDirectMessage, DirectMessageEventContainer, DirectMessageEventsContainer } from "./TwitterTypes";

/**
 * Parse a raw Twitter date, like from a `dm.createdAt`.
 * 
 * For a tweet, please use `TweetArchive.dateFromTweet(tweet)` instead, it's optimized !
 * 
 * For a `LinkedDirectMessage`, use property `.createdAtDate` !
 */
export const parseTwitterDate = TweetArchive.parseTwitterDate;

export function* getEventsFromMessages(msgs: LinkedDirectMessage[], include_messages = false) : Generator<DirectMessageEventContainer, void, void> {
  function* addEvents(e: DirectMessageEventsContainer) {
    for (const [key, vals] of Object.entries(e)) {
      for (const val of vals) {
        yield { [key]: val };
      }
    }
  }

  let first = true;
  for (const msg of msgs) {
    if (first) {
      first = false;
      if (msg.events && msg.events.before) {
        yield* addEvents(msg.events.before);
      }
    }

    if (include_messages) {
      yield { messageCreate: msg };
    }

    if (msg.events && msg.events.after) {
      yield* addEvents(msg.events.after);
    }
  }
}
