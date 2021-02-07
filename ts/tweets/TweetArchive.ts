import { dateFromTweet, sortTweets, isWithMedia, isWithVideo } from "../utils/exported_helpers";
import { TweetIndex } from "../types/Internal";
import { PartialTweetUser, PartialTweet, ClickedTweet } from "../types/ClassicTweets";
import { PartialTweetGDPR, GDPRClickedTweet } from "../types/GDPRTweets";
import Settings from "../utils/Settings";
import { safePusher } from "../utils/helpers";

export interface TweetDateIndex<T> {
  [year: string]: { [month: string]: TweetIndex<T> }
}

export interface TweetLikeContainer<T> {
  add(elements: T[]): void;
  month(month: string | number, year: string | number): T[];
  fromThatDay(start?: Date) : T[];
  single(id_str: string) : T | null;
  has(id_str: string): boolean;
  readonly index: TweetDateIndex<T>;
  readonly length: number;
  readonly all: T[];
  [Symbol.iterator](): Generator<T, void, void>;
}

/**
 * Contains every tweet related to an archive.
 *
 * This object is automatically built when you load an archive inside `TwitterArchive` constructor,
 * or when tweets are loaded through `TwitterArchive.loadArchivePart()` /
 * `TwitterArchive.loadClassicArchivePart()` methods.
 */
export class TweetArchive implements TweetLikeContainer<PartialTweet> {
  /** ID-indexed tweets; This is always filled. */
  protected _index: TweetIndex<PartialTweet> = {};
  /**
   * Year then month-indexed tweets;
   * This is not always generated,
   * use `.index` getter instead.
   */
  protected _date_index: TweetDateIndex<PartialTweet>;
  /**
   * All tweets, in a single array;
   * This is not always generated,
   * use `.all` getter instead.
   */
  protected _all: PartialTweet[];

  protected user_cache: PartialTweetUser;

  protected _finder: TweetFinder;

  protected _clicked: { [id_str: string]: ClickedTweet } = {};
  protected _clicked_urls: Set<string>;


  /** ------------------ */
  /** ARCHIVE MANAGEMENT */
  /** ------------------ */

  /**
   * Add tweets to this archive.
   * This method should not be called by end-programmer.
   *
   * Prefer usage of `TwitterArchive.loadClassicArchivePart()` method.
   */
  add(tweets: PartialTweet[]) {
    this._all = undefined;
    this._date_index = undefined;

    for (const tweet of tweets) {
      this._index[tweet.id_str] = tweet;
    }
  }

  /**
   * Add unconverted GDPR tweets to this archive.
   * This method should not be called by end-programmer.
   *
   * Prefer usage of `TwitterArchive.loadArchivePart()` method.
   */
  addGDPR(tweets: PartialTweetGDPR[]) {
    this._all = undefined;
    this._date_index = undefined;

    for (const original of tweets) {
      const tweet = this.convertToPartial(original);
      this._index[tweet.id_str] = tweet;
    }
  }

  /**
   * Add clicked actions to this container.
   */
  addClicked(clicked_actions: GDPRClickedTweet[]) {
    for (const action of clicked_actions) {
      const data = action.userInteractionsData.linkClick;
      this._clicked[data.tweetId] = {
        id_str: data.tweetId,
        created_at: new Date(data.timeStampOfInteraction),
        url: data.finalUrl
      };
    }
  }


  /** ---------------- */
  /** TWEET NAVIGATION */
  /** ---------------- */

  /** Extract tweets from a specific month. Months are indexed from 1. */
  month(month: string | number, year: string | number) : PartialTweet[] {
    if (this._date_index || Settings.ENABLE_CACHE) {
      const index = this.index;

      if (year in index) {
        if (month in index[year]) {
          return Object.values(index[year][month]);
        }
      }
    }
    else {
      const tweets: PartialTweet[] = [];
      const now_m = Number(month) - 1;
      const now_y = Number(year);

      for (const id in this._index) {
        const tweet = this._index[id];
        const date = dateFromTweet(tweet);

        if (date.getMonth() !== now_m) {
          continue;
        }
        if (date.getFullYear() !== now_y) {
          continue;
        }

        tweets.push(tweet);
      }

      return tweets;
    }

    return [];
  }

  /** Find tweets made on the same day as {start} (= month, = day), but in all years. {start} defaults to now. */
  fromThatDay(start?: Date) : PartialTweet[] {
    start = start instanceof Date ? start : new Date;
    const now_m = start.getMonth();
    const now_d = start.getDate();

    const tweets: PartialTweet[] = [];

    if (this._date_index || Settings.ENABLE_CACHE) {
      const index = this._date_index;

      for (const year in index) {
        for (const month in index[year]) {
          if (Number(month) === now_m + 1) {
            // Month of interest
            safePusher(
              tweets,
              Object
                .values(index[year][month])
                .filter(t => dateFromTweet(t).getDate() === now_d)
            );
          }
        }
      }
    }
    else {
      const now_y = start.getFullYear();

      for (const id in this._index) {
        const tweet = this._index[id];
        const date = dateFromTweet(tweet);

        if (date.getDate() !== now_d) {
          continue;
        }
        if (date.getMonth() !== now_m) {
          continue;
        }
        if (date.getFullYear() !== now_y) {
          continue;
        }

        tweets.push(tweet);
      }
    }

    return tweets;
  }

  /** Get tweets in a specific time interval. */
  between(since: Date | string, until: Date | string) {
    if (typeof since === 'string') {
      since = new Date(since);
    }
    if (typeof until === 'string') {
      until = new Date(until);
    }

    if (since.getTime() > until.getTime()) {
      throw new Error("Since can't be superior to until");
    }

    const firsts: [string, string] = [String(since.getMonth() + 1), String(since.getFullYear())];
    const ends: [string, string] = [String(until.getMonth() + 1), String(until.getFullYear())];

    const remaining_months: [string, string][] = [];

    remaining_months.push(firsts);

    const tmp_date = new Date(since.getFullYear(), since.getMonth());
    tmp_date.setMonth(tmp_date.getMonth() + 1);

    // Calculating months that are between the two dates
    // WITHOUT the end month (already inserted)
    while (
      tmp_date.getFullYear() < until.getFullYear() ||
      tmp_date.getMonth() < until.getMonth()
    ) {
      remaining_months.push([String(tmp_date.getMonth() + 1), String(tmp_date.getFullYear())]);

      tmp_date.setMonth(tmp_date.getMonth() + 1);
    }

    remaining_months.push(ends);

    const tweets: PartialTweet[] = [];

    const [end_day, end_month, end_year] = [until.getDate(), until.getMonth(), until.getFullYear()];

    // Finding tweets that are same or after since date or before until date
    for (const [month, year] of remaining_months) {
      const m = this.month(month, year);

      for (const t of m) {
        const d = dateFromTweet(t);

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
    if (id_str in this._index) {
      return this._index[id_str];
    }

    return null;
  }

  /** Check if tweet {id_str} exists in this archive. */
  has(id_str: string) {
    return id_str in this._index;
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
   * @throws {SyntaxError} Format `{keyword}: Invalid query` if user input is invalid
   * for a specific validator.
   *
   * @throws {ReferenceError} `Validator {name} does not exists` when a invalid static validator is used.
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
  /** ACCESSORS */
  /** --------- */

  /**
   * Index of tweets by years.
   *
   * Example, get index of tweets posted on 2019/01 :
   * **<index>.years[2019][1]**
   */
  get index() {
    if (Settings.ENABLE_CACHE && this._date_index)
      return this._date_index;

    const index: TweetDateIndex<PartialTweet> = {};

    for (const tweet of this) {
      const date = dateFromTweet(tweet);
      const month = String(date.getMonth() + 1);
      const year = String(date.getFullYear());

      // Creating month/year if not presents
      if (!(year in index)) {
        index[year] = {};
      }

      if (!(month in index[year])) {
        index[year][month] = {};
      }

      // Save tweet in index
      index[year][month][tweet.id_str] = tweet;
    }

    if (Settings.ENABLE_CACHE)
      return this._date_index = index;

    return index;
  }

  /**
   * Index of tweets by ID.
   */
  get id_index() {
    return this._index;
  }

  /** Number of tweets in this archive. */
  get length() {
    return this.all.length;
  }

  /**
   * All tweets registered in this archive.
   *
   * Remember that it's not assured that tweets are sorted.
   *
   * To get ordered tweets, use `.sortedIterator()`.
   */
  get all() : PartialTweet[] {
    if (Settings.ENABLE_CACHE) {
      if (this._all)
        return this._all;

      return this._all = Object.values(this._index);
    }
    return Object.values(this._index);
  }

  /**
   * Returns the local `TweetFinder` instance assigned to this `TweetArchive`.
   *
   * A global exported instance also exists and named `TweetSearcher`.
   */
  get finder() {
    if (!this._finder) {
      this._finder = new TweetFinder;
    }

    return this._finder;
  }


  /** ------- */
  /** CLICKED */
  /** ------- */

  get clicked() {
    return Object.values(this._clicked);
  }

  get clicked_urls() {
    if (this._clicked_urls)
      return this._clicked_urls;
    return this._clicked_urls = new Set(this.clicked.map(e => e.url));
  }

  /**
   * Tells if tweet {id_str} has been clicked.
   */
  hasClickedTo(id_str: string) {
    return id_str in this._clicked;
  }

  /**
   * Tells if URL {link} has been clicked by user.
   */
  hasClickedLink(link: string) {
    return this.clicked_urls.has(link);
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
      yield* sortTweets(tweets, order);
    }
  }

  /**
   * Iterate over clicked links sorted by tweet ID.
   *
   * @param order Order by `asc` or `desc`. `desc` by default.
   */
  *sortedClickedIterator(order: "asc" | "desc" = "desc") : Generator<ClickedTweet, void, undefined> {
    yield* sortTweets(this.clicked, order);
  }

  /**
   * Iterate over clicked links sorted by click timestamp.
   *
   * @param order Order by `asc` or `desc`. `desc` by default.
   */
  *dateClickedIterator(order: "asc" | "desc" = "desc") : Generator<ClickedTweet, void, undefined> {
    let sort_fn: (a: ClickedTweet, b: ClickedTweet) => number;
    if (order === "asc") {
      sort_fn = (a, b) => a.created_at.valueOf() - b.created_at.valueOf();
    }
    else {
      sort_fn = (a, b) => b.created_at.valueOf() - a.created_at.valueOf();
    }

    yield* this.clicked.sort(sort_fn);
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

    const index = this.index;

    const sorted_years = Object.keys(index).sort(sort_fn);

    for (const year of sorted_years) {
      const sorted_months = Object.keys(index[year]).sort(sort_fn);

      for (const month of sorted_months) {
        yield [year, month, Object.values(index[year][month])];
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

    if ('tweet' in tweet) {
      return this.convertToPartial(tweet.tweet);
    }

    (tweet as unknown as PartialTweet).user = this.user_cache;
    (tweet as unknown as PartialTweet).text = tweet.full_text;

    // @ts-ignore
    tweet.retweet_count = Number(tweet.retweet_count);
    // @ts-ignore
    tweet.favorite_count = Number(tweet.favorite_count);

    // Gérer le cas des retweets
    const rt_data = /^RT @(.+?): (.+)/s.exec(tweet.full_text);

    if (rt_data && rt_data.length && !("retweeted_status" in tweet)) {
      const [, arobase, text] = rt_data;
      const rt = { ...tweet } as unknown as PartialTweet;
      rt.user = { ...rt.user };

      rt.text = text;

      // Calc the difference between full_text and text length to refresh entities indices
      const diff = rt.full_text.length - rt.text.length;

      // We need to remove the first user mention IF it matches {arobase}
      if (Settings.TRIM_GDPR_RETWEET_ENTITIES) {
        this.refreshEntities(rt, arobase, diff);
        // @ts-ignore
        delete rt.full_text;
      }

      rt.user.screen_name = arobase;
      rt.user.name = arobase;
      // @ts-ignore
      rt.retweeted = true;
      rt.retweet_count = Number(rt.retweet_count);
      rt.favorite_count = Number(rt.favorite_count);

      // Recherche si un ID est disponible par exemple dans les medias (sinon tant pis)
      if (rt.extended_entities && rt.extended_entities.media) {
        if (rt.extended_entities.media.length && rt.extended_entities.media[0].source_user_id_str) {
          rt.user.id_str = rt.extended_entities.media[0].source_user_id_str;
        }
      }

      (tweet as unknown as PartialTweet).retweeted_status = rt;
    }

    return tweet as unknown as PartialTweet;
  }

  protected refreshEntities(tweet: PartialTweet, owner: string, difference: number) {
    if (tweet.entities.user_mentions && tweet.entities.user_mentions.length) {
      const first = tweet.entities.user_mentions[0];
      if (first.screen_name === owner) {
        tweet.entities.user_mentions.shift();
      }
    }

    // Now, the possible bad entity is removed. We need to refresh every "indices" element
    const en = tweet.entities;
    if (en) {
      for (const type in en) {
        // @ts-ignore
        const data = en[type];

        for (const e of data) {
          e.indices = [+e.indices[0] - difference, +e.indices[1] - difference];
        }
      }
      tweet.trimmed_entities = true;
    }

    const ex = tweet.extended_entities;
    if (ex && ex.media && ex.media.length) {
      for (const e of ex.media) {
        e.indices = [String(+e.indices[0] - difference), String(+e.indices[1] - difference)];
      }
    }
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
        return tweet => dateFromTweet(tweet).getTime() >= date.getTime();
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
        return tweet => dateFromTweet(tweet).getTime() < date.getTime();
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

export interface TweetFindOptions {
  use_regex?: boolean | string;
  static_validators?: string[];
  search_in?: ('text' | 'user.name' | 'user.screen_name')[];
  get_debug_results?: (debug: TweetFinderDebugObject) => any;
}

export interface TweetFinderDebugObject {
  validators: {
    [keyword: string]: Array<{
      separator: string,
      callback: Function,
      text: string,
    }>,
  },
  static_validators: Function[],
  text: string,
  query?: RegExp,
}

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
   * Deprecated. Use `.find()` instead, that is more future proof.
   */
  search(
    tweets: Iterable<PartialTweet>,
    query: string,
    is_regex: boolean | string = false,
    static_validators: string[] = [],
    search_in: string[] = ["text", "user.screen_name"]
  ) {
    return [...this.find(query, tweets, {
      use_regex: is_regex,
      static_validators,
      search_in: search_in as ("text" | "user.screen_name" | "user.name")[],
    })];
  }

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
   * To be matched, a tweet must validate ALL the keywords.
   *
   * You can add your custom validators by pushing
   * to **this.validators** a object implementing `TweetSearchValidator`.
   *
   * @param tweets Partial tweets array.
   *
   * @param query String to be searched for in the tweet.text / screen_name.
   * You should remember that in tweets, `>` and `<` are encoded as `&gt;` and `&lt;`.
   *
   * @param options.use_regex If the string should be considered as a regex during text.match or not.
   * - If **use_regex** is `true`, regex will be enabled without flags.
   * - If **use_regex** is `false`, **query** will be regex escaped.
   * - If **use_regex** is a `String`, regex will be enabled with **is_regex** as flags.
   *
   * Validators inside the query, such as `since:2018-01-01` will be removed from the query regex/string.
   *
   * @param options.static_validators Array of static validators names that should used.
   * See `.static_validators`.
   *
   * Default defined static validators are:
   * - `retweets_only`
   * - `medias_only`
   * - `videos_only`
   * - `no_retweets`
   *
   * @param options.search_in Tweet properties to search. This is NOT dynamic you can't specify the property you want.
   * Available properties are:
   * - `text`
   * - `user.screen_name`
   * - `user.name`
   *
   * Default activated properties are `text` and `user.screen_name`.
   *
   * @param options.get_debug_results A callable function that take compiled search options (static validators, validators, text). Defaults to `undefined`.
   *
   * @throws {SyntaxError} Format `{keyword}: Invalid query` if user input is invalid
   * for a specific validator.
   *
   * @throws {ReferenceError} `Validator {name} does not exists` when a invalid static validator is used.
   */
  *find(query: string, tweets: Iterable<PartialTweet>, options: TweetFindOptions = {}) : Generator<PartialTweet, void, undefined> {
    // Search for keywords
    const validators: ((tweet: PartialTweet) => boolean)[] = [];
    // Log validators
    const debug_validators: TweetFinderDebugObject = {
      validators: {},
      static_validators: [],
      text: '',
    };

    // Iterating over validators
    for (const { keyword, validator, separator: raw_separators } of this.validators) {
      // Looking for keyword
      const separators = Array.isArray(raw_separators) ?
        (raw_separators.length ? raw_separators : [":"]) :
        (raw_separators ? [raw_separators] : [":"]);

      for (const separator of separators) {
        // example (?:src_contains:([^\s"]+))|(?:src_contains:"(.+?)")
        // where keyword is "src_contains" and separator is ":"
        const keyword_and_sep = keyword + (separator ? separator : ":");
        const str_kw_reg = `(?:${keyword_and_sep}([^\\s"]+))|(?:${keyword_and_sep}"(.+?)")`;

        // const kw_reg = new RegExp(keyword + (separator ? separator : ":") + '(\\S+)');
        const kw_reg = new RegExp(str_kw_reg);

        let res: RegExpMatchArray = kw_reg.exec(query);

        // If match found
        while (res && (res[1] || res[2])) {
          const matching_group = res[1] || res[2];

          // Deleting the keyword:value of the query
          query = query.replace(new RegExp(str_kw_reg), '').trim();
          let v: ValidatorExecFunction;

          // Generate the validator
          try {
            v = validator(matching_group, separator);
          } catch (e) {}

          if (!v) {
            throw new SyntaxError(keyword + ": Invalid query");
          }

          // Store the validator
          validators.push(v);
          // Add validators to debug
          if (!(keyword in debug_validators.validators)) {
            debug_validators.validators[keyword] = [];
          }
          debug_validators.validators[keyword].push({
            separator,
            callback: v,
            text: matching_group,
          });

          // Re-execute the regex (if same keyword presents multiple times)
          res = kw_reg.exec(query);
        }
      }
    }

    const static_validators = options.static_validators ?? [];
    const is_regex = options.use_regex ?? false;
    const search_in = options.search_in ?? ['text', 'user.screen_name'];

    // Add user choosen static validators to validators
    for (const v of static_validators) {
      if (v in this.static_validators) {
        validators.push(this.static_validators[v]);
        debug_validators.static_validators.push(this.static_validators[v]);
      }
      else {
        throw new ReferenceError("Validator " + v + " does not exists");
      }
    }

    debug_validators.text = query;

    // Building regex
    const flags = typeof is_regex === 'string' ? is_regex : undefined;
    const regex_search = query ? new RegExp(is_regex !== false ? query.trim() : escapeRegExp(query), flags) : null;

    if (regex_search) {
      debug_validators.query = regex_search;
    }

    if (options.get_debug_results) {
      options.get_debug_results(debug_validators);
    }

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
          if (
            (search_text && regex_search.test(t.text)) ||
            (search_name && regex_search.test(t.user.name)) ||
            (search_sn && regex_search.test(t.user.screen_name))
          ) {
            yield t;
          }
        }
        else {
          // No query string, tweet is OK.
          yield t;
        }
      }
    }
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
   * Keyword (word used to identify you keyword, before the **separator**.
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
  validator: (user_query: string, separator: string) => ValidatorExecFunction;
  /**
   * Separator between keyword and user input.
   *
   * Default separator is `:`.
   *
   * Note that spaces are NOT allowed between keyword and separator, and between user input and separator.
   *
   * You can specify multiple allowed separators with a `string[]`.
   */
  separator?: string | string[];
}

export type ValidatorExecFunction = (tweet: PartialTweet) => boolean;

export type TweetSearchStaticValidator = ValidatorExecFunction;

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

