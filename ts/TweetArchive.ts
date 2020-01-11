import { PartialTweet, TweetIndex, PartialTweetGDPR, PartialTweetUser } from "./TwitterTypes";
import bigInt from 'big-integer';
import { supportsBigInt } from './helpers';

export default class TweetArchive {
  protected by_id: TweetIndex = {};
  protected years: { [year: string]: { [month: string]: TweetIndex } } = {};

  protected user_cache: PartialTweetUser;


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

  /** Extract tweets from a specific month. */
  month(month: string, year: string) : PartialTweet[] {
    if (year in this.index.years) {
      if (month in this.index.years[year]) {
        return Object.values(this.index.years[year][month]);
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
    if (id_str in this.index.by_id) {
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

  /** All tweets registered in this archive. */
  get all() : PartialTweet[] {
    return Object.values(this.by_id);
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
   */
  *monthIterator() : Generator<[string, string, PartialTweet], void, void> {
    for (const year in this.years.years) {
      for (const month in this.years.years[year]) {
        for (const tweet of Object.values(this.years.years[year][month])) {
          yield [year, month, tweet];
        }
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
   * Sort tweets by ID.
   */
  static sortTweets(tweets: PartialTweet[]) {
    if (supportsBigInt()) {
      return tweets.sort((a, b) => Number(BigInt(b.id_str) - BigInt(a.id_str)));
    }
    else {
      return tweets.sort((a, b) => (bigInt(b.id_str).minus(bigInt(a.id_str))).toJSNumber());
    }
  }
}
