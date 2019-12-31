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
        let d: Date;
        try {
          d = new Date(data[0]);
        } catch (e) {
          d = new Date;
        }

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
        let d: Date;
        try {
          d = new Date(data[0]);
        } catch (e) {
          d = new Date;
        }

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
      let tns = query.split(',');

      if (tns && tns.length) {
        const regs = tns.map(e => e.trim()).map(e => e.startsWith('@') ? e.split('@', 2)[1] : e).map(e => new RegExp(e, "i"));

        return tweet => {
          // If one of the tns verify
          return regs.some(tn => {
            // If the screen name or the name contain the TN
            // Or if the screen name or the name of the retweeted tweet
            // contain the TN.
            return tweet.user.screen_name.match(tn) ||
              tweet.user.name.match(tn) ||
              (tweet.retweeted_status ? (
                tweet.retweeted_status.user.screen_name.match(tn) ||
                tweet.retweeted_status.user.name.match(tn)
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
      let tns = query.split(',');

      if (tns && tns.length) {
        const rters = tns.map(e => e.trim()).map(e => e.startsWith('@') ? e.split('@', 2)[1] : e).map(e => new RegExp(e, "i"));

        return tweet => {
          return !!tweet.retweeted_status && rters.some(tn => {
            // If tweet is a retweet and if retweets
            // belong to one of the TN
            return tweet.retweeted_status.user.screen_name.match(tn) ||
              tweet.retweeted_status.user.name.match(tn);
          });
        };
      }
    }
  }
];

const INITIAL_STATIC: { [staticName: string]: TweetSearchStaticValidator } = {
  retweets_only: tweet => !!tweet.retweeted_status,
  no_retweets: tweet => !tweet.retweeted_status,
  medias_only: isWithMedia,
  videos_only: isWithVideo,
};

export const TweetSearcher = new class TweetSearcher {
  /**
   * Keywords to use in search query.
   * Each keyword represents a pair **keyword**:**content**.
   * 
   * Keywords are used to add search parameters (conditions) that requires a user input
   * (like tweets before a specific date, retweets of a desired user...).
   * 
   * If you want to add a condition that is static (test if is a retweet,
   * test if tweet has medias...), see `.static_validators`.
   * 
   * See how to add keywords in `TweetSearchValidator` interface.
   */
  validators: TweetSearchValidator[] = INITIAL_VALIDATORS;

  /**
   * Defined "static validators": Validators that does not depends on user query,
   * like test if a tweet is a retweet or keep only tweets with medias.
   * 
   * Validators are represented by its name (in key) 
   * and the validator itself (the check function, in value).
   * 
   * You can use them when you search tweets by specifing the static validators names
   * in the `static_validators` parameter of `search()` method.
   */
  static_validators: { [staticName: string]: TweetSearchStaticValidator } = INITIAL_STATIC;

  /**
   * Search into **tweets** using **query**.
   * 
   * Query can contain keywords.
   * Default available keywords are:
   * - `since:{YYYY-MM-DD}`
   * - `until:{YYYY-MM-DD}`
   * - `from:{screen_name,screen_name_2,screen_name_3}`
   * - `retweet_of:{screen_name} (use of , is allowed, like from:)`
   * 
   * To be in the result array, a tweet must validate ALL the keywords.
   * 
   * You can add your custom validators by pushing 
   * to **this.validators** a object implementing `TweetSearchValidator`.
   * 
   * @param tweets Partial tweets array.
   * 
   * @param query String to be searched for in the tweet.text / screen_name.
   * You should remember that in tweets, `>` and `<` are encoded as `&gt;` and `&lt;`.
   * 
   * @param is_regex If the string should be considered as a regex during text.match or not.
   * - If **is_regex** is `true`, regex will be enabled without flags.
   * - If **is_regex** is `false`, **query** will be regex escaped.
   * - If **is_regex** is a `String`, regex will be enabled with **is_regex** as flags.
   * 
   * Validators inside the query, such as `since:2018-01-01` will be removed from the query regex/string.
   * 
   * @param static_validators Array of static validators names that should used. 
   * See `.static_validators`.
   * 
   * Default defined static validators are:
   * - `retweets_only`
   * - `medias_only`
   * - `videos_only`
   * - `no_retweets`
   * 
   * @param search_in Tweet properties to search. This is NOT dynamic you can't specify the property you want.
   * Available properties are:
   * - `text`
   * - `user.screen_name`
   * - `user.name`
   * 
   * Default activated properties are `text` and `user.screen_name`.
   * 
   * @throws Format `{keyword}: Invalid query` if user input is invalid
   * for a specific validator.
   * 
   * @throws `Validator {name} does not exists` when a invalid static validator is used.
   */
  search(
    tweets: Iterable<PartialTweet>, 
    query: string, 
    is_regex: boolean | string = false, 
    static_validators: string[] = [],
    search_in: string[] = ["text", "user.screen_name"]
  ) {
    // Search for keywords
    const validators: ((tweet: PartialTweet) => boolean)[] = [];

    // Iterating over validators
    for (const { keyword, validator } of this.validators) {
      // Looking for keyword
      const kw_reg = new RegExp(keyword + ':(\\S+)');

      let res: RegExpMatchArray = kw_reg.exec(query);

      // If match found
      while (res && res[1]) {
        // Deleting the keyword:value of the query
        query = query.replace(new RegExp(kw_reg), '').trim();
        let v: ValidatorExecFunction;

        // Generate the validator
        try {
          v = validator(res[1]);
        } catch (e) {}

        if (!v) {
          throw new Error(keyword + ": Invalid query");
        }
        
        // Store the validator
        validators.push(v);

        // Re-execute the regex (if same keyword presents multiple times)
        res = kw_reg.exec(query);
      }
    }

    // Add user choosen static validators to validators
    for (const v of static_validators) {
      if (v in this.static_validators) {
        validators.push(this.static_validators[v]);
      }
      else {
        throw new Error("Validator " + v + " does not exists");
      }
    }

    // Building regex
    const flags = typeof is_regex === 'string' ? is_regex : undefined;
    const regex_search = query ? new RegExp(is_regex !== false ? query.trim() : escapeRegExp(query), flags) : null;

    const results: PartialTweet[] = [];

    // Search for desired properties
    const [search_text, search_name, search_sn] = [
      search_in.includes("text"), 
      search_in.includes("user.name"), 
      search_in.includes("user.screen_name")
    ];

    for (const t of tweets) {
      // Each validator must be verified
      if (validators.every(v => v(t))) {
        // If a query exists (user can just have typed keywords)
        if (regex_search) {
          // Test desired property
          if (search_text && regex_search.test(t.text)) {
            results.push(t);
          }
          else if (search_name && regex_search.test(t.user.name)) {
            results.push(t);
          }
          else if (search_sn && regex_search.test(t.user.screen_name)) {
            results.push(t);
          }
        }
        else {
          results.push(t);
        }
      }
    }

    return results;
  }

  /** Reset validators. This does NOT work if you have modified the inner initial objects ! */
  reset() {
    this.validators = INITIAL_VALIDATORS;
    this.static_validators = INITIAL_STATIC;
  }
};

export default TweetSearcher;

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
   * with thrown **unwell-formed query error**.
   * 
   * ---
   * 
   * For example, if you want to validate tweets that are above a date
   * entered by the user, with the schema: `keyword:YYYY-MM-DD`,
   * `YYYY-MM-DD` entered by the user will be given in parameter to this attribute (`.validator`),
   * which should return a function that test if the tweet date is above user entered `YYYY-MM-DD`.
   * 
   * **EXAMPLE**
   * 
   * *Do not use this example in real case, it does not check well user input.*
   * 
   * ```ts
   * validator: user_query => {
   *  // Parse user input
   *  const time = (new Date(user_query)).getTime();
   * 
   *  // Check some data validity
   *  if (isNaN(time)) {
   *    // Data could not be used, validator is invalid, returns undefined.
   *    // This will throw an Error.
   *    return undefined;
   *  }
   *  
   *  // Return the validator function that returns true if tweet date >= user's date.
   *  return tweet => dateFromTweet(tweet).getTime() >= time;
   * }
   * ```
   */
  validator: (user_query: string) => ValidatorExecFunction;
}

type ValidatorExecFunction = (tweet: PartialTweet) => boolean;

export type TweetSearchStaticValidator = ValidatorExecFunction;

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
