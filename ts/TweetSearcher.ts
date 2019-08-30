import { PartialTweet } from "./TwitterTypes";
import { dateFromTweet, isWithMedia, isWithVideo } from "./Archive";

const INITIAL_VALIDATORS: TweetSearchValidator[] = [
  /** since: validator */
  {
    keyword: 'since',
    validator: query => {
      // Check if query is ok
      const data = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(query);
      
      if (data && data.length) {
        // full query
        const d = new Date(data[0]);

        if (!isNaN(d.getTime())) {
          return tweet => dateFromTweet(tweet).getTime() >= d.getTime();
        }
      }
    }
  },
  /** until: validator */
  {
    keyword: 'until',
    validator: query => {
      // Check if query is ok
      const data = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(query);
      
      if (data && data.length) {
        // full query
        const d = new Date(data[0]);

        if (!isNaN(d.getTime())) {
          d.setDate(d.getDate() + 1);

          return tweet => dateFromTweet(tweet).getTime() < d.getTime();
        }
      }
    }
  },
  /** from: validator */
  {
    keyword: 'from',
    validator: query => {
      // Check if query is ok
      let tns = query.split('|');

      if (tns && tns.length) {
        tns = tns.map(e => e.startsWith('@') ? e.split('@', 2)[1] : e);

        return tweet => {
          // If one of the tns verify
          return tns.some(tn => {
            // If the screen name or the name contain the TN
            // Or if the screen name or the name of the retweeted tweet
            // contain the TN.
            return tweet.user.screen_name.includes(tn) ||
              tweet.user.name.includes(tn) ||
              (tweet.retweeted_status ? (
                tweet.retweeted_status.user.screen_name.includes(tn) ||
                tweet.retweeted_status.user.name.includes(tn)
              ) : false);
          });
        };
      }
    }
  },
  /** retweet_of: validator */
  {
    keyword: 'retweet_of',
    validator: query => {
      // Check if query is ok
      let tns = query.split('|');

      if (tns && tns.length) {
        tns = tns.map(e => e.startsWith('@') ? e.split('@', 2)[1] : e);

        return tweet => {
          return !!tweet.retweeted_status && tns.some(tn => {
            // If tweet is a retweet and if retweets
            // belong to one of the TN
            return tweet.retweeted_status.user.screen_name.includes(tn) ||
              tweet.retweeted_status.user.name.includes(tn);
          });
        };
      }
    }
  }
];

const INITIAL_STATIC: { [staticName: string]: TweetSearchStaticValidator } = {
  retweet_only: tweet => !!tweet.retweeted_status,
  medias_only: tweet => isWithMedia(tweet),
  videos_only: tweet => isWithVideo(tweet),
}

export const TweetSearcher = new class {
  validators: TweetSearchValidator[] = INITIAL_VALIDATORS;
  static_validators: { [staticName: string]: TweetSearchStaticValidator } = INITIAL_STATIC;

  /**
   * Search into {tweets} parameters using {query}.
   * Query is converted to regex if {is_regex}==true, 
   * after keywords are removed from the query.
   * 
   * Default available keywords are:
   * - `since:{YYYY-MM-DD}`
   * - `until:{YYYY-MM-DD}`
   * - `from:{screen_name|screen_name_2|screen_name_3}`
   * - `retweet_of:{screen_name} (use of | is allowed, like from:)`
   * 
   * To be in the result array, a tweet must validate ALL the keywords.
   * 
   * You can add your custom validators by pushing 
   * to **this.validators** a **TweetSearchValidator** variable.
   * 
   * @param tweets Partial tweets array.
   * @param query String to be searched for in the tweet.text
   * @param is_regex If the string should be considered as a regex during text.match or not.
   * @param static_validators Array of static validators names that should used.
   * 
   * @throws Format "{keyword}: Invalid query" if user input is invalid
   * for a specific validator.
   * 
   * @throws "Validator {name} does not exists" when a invalid static validator is used.
   */
  searchIntoTweets(tweets: PartialTweet[], query: string, is_regex: boolean = false, static_validators: string[] = []) {
    // Search for keywords
    const validators: ((tweet: PartialTweet) => boolean)[] = [];

    for (const { keyword, validator } of this.validators) {
      const kw_reg = new RegExp(keyword + ':(\\S+)');

      let res: RegExpMatchArray = kw_reg.exec(query);
      while (res && res[1]) {
        query = query.replace(new RegExp(kw_reg), '').trim();
        const v = validator(res[1]);

        if (!v) {
          throw new Error(keyword + ": Invalid query");
        }
        
        validators.push(v);
        res = kw_reg.exec(query);
      }
    }

    for (const v of static_validators) {
      if (v in this.static_validators) {
        validators.push(this.static_validators[v]);
      }
      else {
        throw new Error("Validator " + v + " does not exists");
      }
    }

    const result: PartialTweet[] = [];

    const regex_search = query ? new RegExp(is_regex ? query.trim() : escapeRegExp(query)) : null;

    for (const t of tweets) {
      if (validators.every(v => v(t))) {
        if (regex_search) {
          if (regex_search.test(t.text)) {
            result.push(t);
          }
        }
        else {
          result.push(t);
        }
      }
    }

    return result;
  }

  reset() {
    this.validators = INITIAL_VALIDATORS;
    this.static_validators = INITIAL_STATIC;
  }
};

export interface TweetSearchValidator {
  /** 
   * Keyword (word used to identify you keyword, before the **:**.
   * Will be interpoled into search regex. 
   * Should **NOT** contain parenthesis !
   */
  keyword: string;
  /**
   * Method that generate a validator function with user input in your **query**.
   * This method **should** return a *function*.
   * 
   * You should verify user-input stored inside {user_query}. 
   * 
   * If the return type is null-ish (`undefined`, `null`, `false`,...), search will be **aborted**
   * with **unwell-formed query error**.
   */
  validator: (user_query: string) => ((tweet: PartialTweet) => boolean);
}

export type TweetSearchStaticValidator = (tweet: PartialTweet) => boolean;

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
