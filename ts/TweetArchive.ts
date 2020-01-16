import { PartialTweet, TweetIndex, PartialTweetGDPR, PartialTweetUser } from "./TwitterTypes";
import bigInt from 'big-integer';
import { supportsBigInt } from './helpers';

//// TWEETARCHIVE
export class TweetArchive {
  protected by_id: TweetIndex = {};
  protected years: { [year: string]: { [month: string]: TweetIndex } } = {};

  protected user_cache: PartialTweetUser;

  protected tweet_searcher: TweetFinder;


  /** ------------------ */
  /** ARCHIVE MANAGEMENT */
  /** ------------------ */

  /**
   * Add tweets to this archive.
   */
  add(tweets: PartialTweet[]) {
    for (const tweet of tweets) {
      const date = TweetArchive.dateFromTweet(tweet);
  
      const month = String(date.getMonth() + 1);
      const year = String(date.getFullYear());
  
      // Creating month/year if not presents
      if (!(year in this.years)) {
        this.years[year] = {};
      }
  
      if (!(month in this.years[year])) {
        this.years[year][month] = {};
      }
  
      // Save tweet in index
      this.years[year][month][tweet.id_str] = tweet;
      this.by_id[tweet.id_str] = tweet;
    }
  }

  /**
   * Add unconverted GDPR tweets to this archive.
   */
  addGDPR(tweets: PartialTweetGDPR[]) {
    for (const original of tweets) {
      const tweet = this.convertToPartial(original);
      const date = TweetArchive.dateFromTweet(tweet);
  
      const month = String(date.getMonth() + 1);
      const year = String(date.getFullYear());
  
      // Creating month/year if not presents
      if (!(year in this.years)) {
        this.years[year] = {};
      }
  
      if (!(month in this.years[year])) {
        this.years[year][month] = {};
      }
  
      // Save tweet in index
      this.years[year][month][tweet.id_str] = tweet;
      this.by_id[tweet.id_str] = tweet;
    }
  }

  
  /** ---------------- */
  /** TWEET NAVIGATION */
  /** ---------------- */

  /** Extract tweets from a specific month. Months are indexed from 1. */
  month(month: string | number, year: string | number) : PartialTweet[] {
    if (year in this.years) {
      if (month in this.years[year]) {
        return Object.values(this.years[year][month]);
      }
    }

    return [];
  }

  /** Find tweets made on the same day (= month, = day), but in all years. */
  fromThatDay() : PartialTweet[] {
    const now = new Date;
    const now_m = now.getMonth();
    const now_d = now.getDate();

    // TODO optimize
    return this.all.filter(t => {
      const d = TweetArchive.dateFromTweet(t);
      return d.getMonth() === now_m && d.getDate() === now_d;
    });
  }

  /** Get tweets in a specific time interval. */
  between(since: Date, until: Date) {
    if (since.getTime() > until.getTime()) {
      throw new Error("Since can't be superior to until");
    }

    const firsts: [string, string] = [String(since.getMonth() + 1), String(since.getFullYear())];
    const ends: [string, string] = [String(until.getMonth() + 1), String(until.getFullYear())];

    const remaining_months: [string, string][] = [];

    remaining_months.push(firsts);

    let tmp_date = new Date(since.getFullYear(), since.getMonth());
    tmp_date.setMonth(tmp_date.getMonth() + 1);

    remaining_months.push(ends);

    // Calculating months that are between the two dates
    while (true) {
      if (tmp_date.getFullYear() > until.getFullYear()) {
        break;
      }
      if (tmp_date.getFullYear() === until.getFullYear()) {
        if (tmp_date.getMonth() >= until.getMonth()) {
          break;
        }
      }

      remaining_months.push([String(tmp_date.getMonth() + 1), String(tmp_date.getFullYear())]);

      tmp_date.setMonth(tmp_date.getMonth() + 1);
    }

    const tweets: PartialTweet[] = [];

    const [end_day, end_month, end_year] = [until.getDate(), until.getMonth(), until.getFullYear()];
    
    // Finding tweets that are same or after since date or before until date
    for (const [month, year] of remaining_months) {
      const m = this.month(month, year);

      for (const t of m) {
        const d = TweetArchive.dateFromTweet(t);

        if (d.getTime() >= since.getTime()) {
          if (d.getFullYear() < end_year || d.getMonth() < end_month || d.getDate() <= end_day) {
            tweets.push(t);
          }
        }
      }
    }

    return tweets;
  }

  /** Get a single tweet by ID. Returns `null` if tweet does not exists. */
  single(id_str: string) : PartialTweet | null {
    if (id_str in this.by_id) {
      return this.by_id[id_str];
    }

    return null;
  }


  /** --------- */
  /** ACCESSORS */
  /** --------- */

  /**
   * Index of tweets by years. 
   * 
   * Example, get index of tweets posted on 2019/01 : 
   * **<index>.years[2019][1]**
   */
  get index() {
    return this.years;
  }

  /**
   * Index of tweets by ID.
   */
  get id_index() {
    return this.by_id;
  }

  /** Number of tweets in this archive. */
  get length() {
    return Object.keys(this.by_id).length;
  }

  /** 
   * All tweets registered in this archive.
   * 
   * Remember that it's not assured that tweets are sorted.
   * 
   * To get ordered tweets, use `.sortedIterator()`.
   */
  get all() : PartialTweet[] {
    return Object.values(this.by_id);
  }

  /**
   * Returns the local `TweetFinder` instance assigned to this `TweetArchive`.
   * 
   * A global exported instance also exists and named `TweetSearcher`.
   */
  get finder() {
    if (!this.tweet_searcher) {
      this.tweet_searcher = new TweetFinder;
    }

    return this.tweet_searcher;
  }

  /**
   * Find tweets matching **query** in this tweet archive.
   * 
   * This is a shortcut of `.finder.search(tweets, ...)`
   * 
   * --- 
   * 
   * **Documentation from `TweetFinder.search()`** :
   * 
   * Query can contain keywords.
   * Default available keywords are:
   * - `since:{YYYY-MM-DD} or {YYYY-MM} or {YYYY}`
   * - `until:{YYYY-MM-DD} or {YYYY-MM} or {YYYY}`
   * - `from:{screen_name,screen_name_2,screen_name_3}`
   * - `retweet_of:{screen_name} (use of , is allowed, like from:)`
   * 
   * To be in the result array, a tweet must validate ALL the keywords.
   * 
   * You can add your custom validators by pushing 
   * to **.finder.validators** a object implementing `TweetSearchValidator`.
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
   * See `.finder.static_validators`.
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
  find(
    query: string, 
    is_regex: boolean | string = false, 
    static_validators: string[] = [],
    search_in: string[] = ["text", "user.screen_name"]
  ) {
    return this.finder.search(this, query, is_regex, static_validators, search_in);
  }

  /** --------- */
  /** ITERATORS */
  /** --------- */

  /**
   * Iterate through the tweets
   */
  *[Symbol.iterator]() {
    yield* this.all;
  }

  /**
   * Iterate through tweets, sorted by year and month.
   * 
   * At each iteration: [year: string, month: string, tweet: PartialTweet]
   * 
   * @param order Order **months** and **years** by `asc` or `desc`. `asc` by default.
   * This do **NOT** sort tweets, use `.sortedIterator()` instead !
   */
  *monthIterator(order: "asc" | "desc" = "asc") : Generator<[string, string, PartialTweet], void, void> {
    for (const [year, month, tweets] of this.arrayMonthIterator(order)) {
      for (const tweet of tweets) {
        yield [year, month, tweet];
      }
    }
  }

  /**
   * Iterate over tweets, which are **genuinely** sorted (date, {order}).
   * 
   * @param order Order by `asc` or `desc`. `desc` by default.
   */
  *sortedIterator(order: "asc" | "desc" = "desc") : Generator<PartialTweet, void, undefined> {
    for (const [, , tweets] of this.arrayMonthIterator(order)) {
      yield* TweetArchive.sortTweets(tweets, order);
    }
  }

   /**
   * Iterate array of tweets by month
   * 
   * @param order Order by `asc` or `desc`.
   */
  protected *arrayMonthIterator(order: "asc" | "desc") : Generator<[string, string, PartialTweet[]], void, void> {
    let sort_fn: (a: string, b: string) => number;
    if (order === "asc") {
      sort_fn = (a, b) => Number(a) - Number(b);
    }
    else {
      sort_fn = (a, b) => Number(b) - Number(a);
    }

    const sorted_years = Object.keys(this.years).sort(sort_fn);

    for (const year of sorted_years) {
      const sorted_months = Object.keys(this.years[year]).sort(sort_fn);

      for (const month of sorted_months) {
        yield [year, month, Object.values(this.years[year][month])];
      }
    }
  }


  /** ------- */
  /** HELPERS */
  /** ------- */

  /**
   * Needed to convert GDPR tweets to PartialTweets.
   * 
   * **You should not use this method! This is for internal purpose.**
   */
  __initUserCache(user_info: {
    id_str: string,
    name: string,
    screen_name: string,
    profile_image_url_https: string
  }) {
    this.user_cache = {
      protected: false,
      id_str: user_info.id_str,
      name: user_info.name,
      screen_name: user_info.screen_name,
      profile_image_url_https: user_info.profile_image_url_https
    };
  }

  protected convertToPartial(tweet: PartialTweetGDPR) : PartialTweet {
    if (!this.user_cache) {
      throw new Error("User cache hasn't be filled. Init it with .__initUserCache().");
    }

    (tweet as unknown as PartialTweet).user = this.user_cache;
    (tweet as unknown as PartialTweet).text = tweet.full_text;

    // @ts-ignore
    tweet.retweet_count = Number(tweet.retweet_count);
    // @ts-ignore
    tweet.favorite_count = Number(tweet.favorite_count);

    // Gérer le cas des retweets
    const rt_data = /^RT @(.+?): (.+)/.exec(tweet.full_text);

    if (rt_data && rt_data.length && !("retweeted_status" in tweet)) {
      const [, arobase, text] = rt_data;
      const rt = { ...tweet } as unknown as PartialTweet;
      rt.user = { ...rt.user };

      rt.text = text;
      rt.user.screen_name = arobase;
      rt.user.name = arobase;
      // @ts-ignore
      rt.retweeted = true;
      rt.retweet_count = Number(rt.retweet_count);
      rt.favorite_count = Number(rt.favorite_count);

      // Recherche si un ID est disponible par exemple dans les medias (sinon tant pis)
      if (rt.extended_entities && rt.extended_entities.media) {
        if (rt.extended_entities.media.length) {
          rt.user.id_str = rt.extended_entities.media[0].source_user_id_str;
        }
      }

      (tweet as unknown as PartialTweet).retweeted_status = rt;
    }

    return tweet as unknown as PartialTweet;
  }

  /**
   * True if given tweet is coming from a GDPR archive.
   * 
   * Tweets getted by available getters are NOT GDPR tweets, they've been converted !
   */
  static isGDPRTweet(tweet: PartialTweetGDPR | PartialTweet) : tweet is PartialTweetGDPR {
    return 'retweet_count' in tweet;
  }

  /** Return the `Date` object affiliated to **tweet**. */
  static dateFromTweet(tweet: PartialTweet) : Date {
    if (tweet.created_at_d && tweet.created_at_d instanceof Date) {
      return tweet.created_at_d;
    }
    return tweet.created_at_d = TweetArchive.parseTwitterDate(tweet.created_at);
  }

  /**
   * Parse a raw Twitter date, from a `dm.createdAt` or `tweet.created_at`.
   * 
   * For a tweet, please use `dateFromTweet(tweet)` instead, it's optimized !
   */
  static parseTwitterDate(date: string) : Date {
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

  /** 
   * Return true if **tweet** contains media(s).
   * 
   * This includes photos, videos or animated GIF.
   */
  static isWithMedia(tweet: PartialTweet) {
    return tweet.entities.media.length > 0;
  }

  /**
   * Return true if **tweet** contains a video or one animated GIF.
   * 
   * Twitter's GIF are mp4 encoded.
   */
  static isWithVideo(tweet: PartialTweet) {
    if (tweet.extended_entities) {
      if (tweet.extended_entities.media) {
        return tweet.extended_entities.media.some(m => m.type !== "photo");
      }
    }

    return false;
  }

  /**
   * Sort tweets by ID (descending order by default).
   */
  static sortTweets(tweets: PartialTweet[], order: "asc" | "desc" = "desc") {
    let sort_fn: (a: PartialTweet, b: PartialTweet) => number;

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
}

export default TweetArchive;


//// TWEETSEARCHER

function dateRegexFromQuery(query: string) {
  // Match YYYY or YYYY-MM or YYYY-MM-DD
  const data = /^([0-9]{4})(-([0-9]{2})(-([0-9]{2}))?)?$/.exec(query);

  if (data && data.length) {
    // Year is group 1, month is group 3, day is group 5
    const [year, month, day] = [data[1], data[3], data[5]];

    let d: Date;
    // full query
    if (day) {
      d = new Date(Number(year), Number(month) - 1, Number(day));
    }
    // year and month
    else if (month) {
      d = new Date(Number(year), Number(month) - 1);
    }
    // only year
    else {
      d = new Date(Number(year), 0);
    }

    if (!isNaN(d.getTime())) {
      return d;
    }
  }
}

const INITIAL_VALIDATORS: TweetSearchValidator[] = [
  /** since: validator */
  {
    keyword: 'since',
    validator: query => {
      const date = dateRegexFromQuery(query);
      
      // Check if query is ok
      if (date) {
        return tweet => TweetArchive.dateFromTweet(tweet).getTime() >= date.getTime();
      }
    }
  },
  /** until: validator */
  {
    keyword: 'until',
    validator: query => {
      const date = dateRegexFromQuery(query);
      
      // Check if query is ok
      if (date) {
        date.setDate(date.getDate() + 1);
        return tweet => TweetArchive.dateFromTweet(tweet).getTime() < date.getTime();
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
  medias_only: TweetArchive.isWithMedia,
  videos_only: TweetArchive.isWithVideo,
};

export class TweetFinder {
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
  validators: TweetSearchValidator[] = [...INITIAL_VALIDATORS];

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
  static_validators: { [staticName: string]: TweetSearchStaticValidator } = { ...INITIAL_STATIC };

  /**
   * Search into **tweets** using **query**.
   * 
   * Query can contain keywords.
   * Default available keywords are:
   * - `since:{YYYY-MM-DD} or {YYYY-MM} or {YYYY}`
   * - `until:{YYYY-MM-DD} or {YYYY-MM} or {YYYY}`
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

export const TweetSearcher = new TweetFinder;

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

export type ValidatorExecFunction = (tweet: PartialTweet) => boolean;

export type TweetSearchStaticValidator = ValidatorExecFunction;

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

