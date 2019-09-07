import JSZip from 'jszip';
import { ArchiveIndex, PartialTweetGDPR, PartialTweet, AccountGDPR, ProfileGDPR, ClassicTweetIndex, ClassicPayloadDetails, TwitterUserDetails, DMFile, PartialTweetUser, GDPRFollowings, GDPRFollowers, GDPRFavorites, GDPRMutes, InnerGDPRPersonalization, GPDRScreenNameHistory, GPDRProtectedHistory, GDPRBlocks, GDPRAgeInfo, InnerGDPRAgeInfo, GDPRMoment, GDPRMomentFile } from './TwitterTypes';
import DMArchive from './DMArchive';
import { EventTarget, defineEventAttribute } from 'event-target-shim';

export type AcceptedZipSources = string | number[] | Uint8Array | ArrayBuffer | Blob | NodeJS.ReadableStream | JSZip;
export type ArchiveReadState = "idle" | "reading" | "indexing" | "tweet_read" | "user_read" | "dm_read" | "extended_read" | "ready";

/** Raw informations stored in GDPR, extracted for a simpler use.
 * 
 * This includes list of followers, followings, favorites, mutes, blocks,
 * registered and subscribed lists, history of screen names, and Twitter moments.
 */
export interface ExtendedGDPRInfo {
  followers: Set<string>;
  followings: Set<string>;
  favorites: Set<string>;
  mutes: Set<string>;
  blocks: Set<string>;
  lists: {
    created: string[];
    member_of: string[];
    subscribed: string[];
  };
  personalization: InnerGDPRPersonalization;
  screen_name_history: GPDRScreenNameHistory[];
  protected_history: GPDRProtectedHistory[];
  age_info: InnerGDPRAgeInfo;
  moments: GDPRMoment[];
}

/** Return the `Date` object affiliated to **tweet**. */
export function dateFromTweet(tweet: PartialTweet) : Date {
  if (tweet.created_at_d) {
    return tweet.created_at_d;
  }
  return tweet.created_at_d = new Date(tweet.created_at);
}

/** 
 * Return true if **tweet** contains media(s).
 * 
 * This includes photos, videos or animated GIF.
 */
export function isWithMedia(tweet: PartialTweet) {
  return tweet.entities.media.length > 0;
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

class Archive {
  protected _ready: Promise<void> = Promise.resolve();
  protected archive: JSZip;

  constructor(file: AcceptedZipSources) {
    if (file instanceof JSZip) {
      this._ready = Promise.resolve();
      this.archive = file;
      return;
    }

    this._ready = JSZip.loadAsync(file)
      .then(data => {
        this.archive = data;
      });
  }

  ready() {
    return this._ready;
  }

  dir(name: string) {
    return new Archive(this.archive.folder(name));
  }

  has(name: string) {
    return this.search(new RegExp(`^${name}$`)).length > 0;
  }

  get(
    name: string, 
    type: "text" 
      | "arraybuffer" 
      | "blob" 
    = "text",
    parse_auto = true
  ) {
    return this.read(this.archive.file(name), type, parse_auto);
  }

  search(query: RegExp) {
    return this.archive.file(query);
  }

  searchDir(query: RegExp) {
    return this.archive.folder(query);
  }

  read(
    file: JSZip.JSZipObject, 
    type: "text" 
      | "arraybuffer" 
      | "blob" 
    = "text",
    parse_auto = true
  ) {
    const p = file.async(type);

    if (parse_auto) {
      return p.then(data => {
        if (typeof data === 'string') {
          return JSON.parse(data.substr(data.indexOf('=') + 1).trimLeft());
        }
        else {
          return data;
        }
      }); 
    }
    else {
      return p;
    }
  }

  ls(current_dir_only = true) {
    if (!current_dir_only) {
      return this.archive.files;
    }

    const l = this.archive.files;
    const files: { [name: string]: JSZip.JSZipObject } = {};

    for (const key in l) {
      if (!key.includes('/')) {
        files[key] = l[key];
      }
    }

    return files;
  }
}

type TwitterArchiveEvents = {
  zipready: CustomEvent<void>;
  userinfosready: CustomEvent<void>;
  tweetsread: CustomEvent<void>;
  indexready: CustomEvent<void>;
  willreaddm: CustomEvent<void>;
  willreadextended: CustomEvent<void>;
  ready: CustomEvent<void>;
  error: CustomEvent<any>;
};

type TwitterArchiveOnEvents = {
  onzipready: CustomEvent<void>;
  onuserinfosready: CustomEvent<void>;
  ontweetsread: CustomEvent<void>;
  onindexready: CustomEvent<void>;
  onwillreaddm: CustomEvent<void>;
  onwillreadextended: CustomEvent<void>;
  onready: CustomEvent<void>;
  onerror: CustomEvent<any>;
};

/**
 * Represents a full TwitterArchive. Support GDPR and classic archive.
 * 
 * Remember that tweets, in searchs in particular are **NOT** sorted.
 * 
 * Direct messages, parsed if archive is a GDPR archive, stored in `.messages`, 
 * are returned and sorted from the most older to the more recent.
 */
export class TwitterArchive extends EventTarget<TwitterArchiveEvents, TwitterArchiveOnEvents> {
  protected _ready: Promise<void> = Promise.resolve();
  protected archive: Archive;

  /** Current archive load state. */
  public state: ArchiveReadState = "idle";

  /** 
   * Access to extended infos. See `ExtendedGDPRInfo` interface. 
   * 
   * Defined only if `.is_gdpr === true`.
   * */
  extended_gdpr: ExtendedGDPRInfo;

  protected _index: ArchiveIndex = {
    info: {
      screen_name: "",
      full_name: "",
      location: "fr",
      bio: "",
      id: "",
      created_at: (new Date).toISOString()
    },
    archive: {
      created_at: (new Date).toISOString(),
      tweets: 0
    },
    years: {},
    by_id: {}
  };

  protected dms: DMArchive;

  protected _is_gdpr = false;

  protected user_cache: PartialTweetUser;

  /**
   * Build a new instance of TwitterArchive.
   * 
   * @param file Accept any source that `JSZip` library accepts.
   * @param build_extended True if `.extended_gdpr` should be built (only if **file** is a GDPR archive.)
   */
  constructor(file: AcceptedZipSources, build_extended = true) {
    super();

    this.state = "reading";

    this.archive = new Archive(file);
    this._ready = this.archive.ready()
      .then(() => {
        this.dispatchEvent({type:'zipready'});

        // Initialisation de l'archive Twitter
        if (this.isGDPRArchive()) {
          return this.initGDPR(build_extended);
        }
        else {
          return this.initClassic();
        }
      })
      .then(() => {
        this.dispatchEvent({type: 'ready'});
      })
      .catch(e => {
        this.dispatchEvent({type: 'error', detail: e });
        return Promise.reject(e);
      });
  }

  protected async initGDPR(extended = false) {
    this.state = "user_read";

    // Init informations
    const account_arr: AccountGDPR = await this.archive.get('account.js');
    const profile_arr: ProfileGDPR = await this.archive.get('profile.js');

    const [account, profile] = [account_arr[0].account, profile_arr[0].profile];

    this.index.info = {
      screen_name: account.username,
      full_name: account.accountDisplayName,
      location: profile.description.location,
      bio: profile.description.bio,
      id: account.accountId,
      created_at: account.createdAt
    };

    this.dispatchEvent({type: 'userinfosready'});

    this.state = "tweet_read";

    // Init tweet indexes
    const tweets: PartialTweetGDPR[] = await this.archive.get('tweet.js');

    let i = 1;
    while (this.archive.has(`tweet-part${i}.js`)) {
      // Add every tweet in other files 
      // inside a "new" array in the initial array
      tweets.push(...(await this.archive.get(`tweet-part${i}.js`)));
      i++;
    }

    this.dispatchEvent({type: 'tweetsread'});

    this.state = "indexing";

    // Build index
    for (let i = 0; i < tweets.length; i++) {
      const date = new Date(tweets[i].created_at);

      const month = String(date.getMonth() + 1);
      const year = String(date.getFullYear());

      // Creating month/year if not presents
      if (!(year in this.index.years)) {
        this.index.years[year] = {};
      }

      if (!(month in this.index.years[year])) {
        this.index.years[year][month] = {};
      }

      // Save tweet in index
      const converted = this.convertToPartial(tweets[i], profile.avatarMediaUrl);
      this.index.years[year][month][tweets[i].id_str] = converted;
      this.index.by_id[tweets[i].id_str] = converted;
    }

    this.dispatchEvent({type: 'indexready'});
    
    // Register info
    this._index.archive.tweets = tweets.length;
    
    // Init DMs
    this.dms = new DMArchive(this.owner);
    
    this.state = "dm_read";
    this.dispatchEvent({type: 'willreaddm'});
    
    const conversations: DMFile = await this.archive.get('direct-message.js');
    this.dms.add(conversations);

    i = 1;
    while (this.archive.has(`direct-message-part${i}.js`)) {
      // Add every tweet in other files 
      // inside a "new" array in the initial array
      this.dms.add(await this.archive.get(`direct-message-part${i}.js`) as DMFile);
      i++;
    }

    if (this.archive.has('direct-message-group.js')) {
      this.dms.add(await this.archive.get('direct-message-group.js') as DMFile);
    }
    // DMs should be ok

    this.state = "extended_read";
    this.dispatchEvent({type: 'willreadextended'});

    if (extended) {
      await this.initExtendedGDPR();
    }
    this.state = "ready";
  }

  protected async initExtendedGDPR() {
    // Followings
    const f_following: GDPRFollowings = await this.archive.get('following.js');
    const followings = new Set<string>();
    for (const f of f_following) {
      followings.add(f.following.accountId);
    }

    // Followers
    const f_follower: GDPRFollowers = await this.archive.get('follower.js');
    const followers = new Set<string>();
    for (const f of f_follower) {
      followers.add(f.follower.accountId);
    }

    // Favorites
    const f_fav: GDPRFavorites = await this.archive.get('like.js');
    const favorites = new Set<string>();
    for (const f of f_fav) {
      favorites.add(f.like.tweetId);
    }

    // Mutes
    const f_mutes: GDPRMutes = await this.archive.get('mute.js');
    const mutes = new Set<string>();
    for (const f of f_mutes) {
      mutes.add(f.muting.accountId);
    }

    // Blocks
    const f_block: GDPRBlocks = await this.archive.get('block.js');
    const blocks = new Set<string>();
    for (const f of f_block) {
      blocks.add(f.blocking.accountId);
    }

    // Lists
    const lists = {
      created: (await this.archive.get('lists-created.js'))[0].userListInfo.urls,
      member_of: (await this.archive.get('lists-member.js'))[0].userListInfo.urls,
      subscribed: (await this.archive.get('lists-subscribed.js'))[0].userListInfo.urls
    };

    // Personalization
    const personalization = (await this.archive.get('personalization.js'))[0].p13nData;

    const age_info = (await this.archive.get('ageinfo.js') as GDPRAgeInfo)[0].ageMeta;

    // SN history
    const f_history = await this.archive.get('screen-name-change.js') as { screenNameChange: GPDRScreenNameHistory }[];
    const screen_name_history: GPDRScreenNameHistory[] = [];
    for (const e of f_history) {
      screen_name_history.push(e.screenNameChange);
    }

    // Protected history
    const f_phistory = await this.archive.get('protected-history.js') as { protectedHistory: GPDRProtectedHistory }[];
    const protected_history: GPDRProtectedHistory[] = [];
    for (const e of f_phistory) {
      protected_history.push(e.protectedHistory);
    }

    // Moments
    const moments: GDPRMoment[] = (await this.archive.get('moment.js') as GDPRMomentFile).map(e => e.moment);

    this.extended_gdpr = {
      moments,
      protected_history,
      screen_name_history,
      age_info,
      personalization,
      lists,
      favorites,
      followers,
      followings,
      mutes,
      blocks
    };
  }

  protected convertToPartial(tweet: PartialTweetGDPR, pic_prof: string) : PartialTweet {
    if (!this.user_cache) {
      this.user_cache = {
        protected: false,
        id_str: this._index.info.id,
        name: this._index.info.full_name,
        screen_name: this._index.info.screen_name,
        profile_image_url_https: pic_prof
      };
    }

    (tweet as unknown as PartialTweet).user = this.user_cache;
    (tweet as unknown as PartialTweet).text = tweet.full_text;

    // Gérer le cas des retweets
    const rt_data = /^RT @(.+): (.+)/.exec(tweet.full_text);

    if (rt_data && rt_data.length && !("retweeted_status" in tweet)) {
      const [, arobase, text] = rt_data;
      const rt = Object.assign({}, tweet) as unknown as PartialTweet;
      rt.user = Object.assign({}, rt.user);

      rt.text = text;
      rt.user.screen_name = arobase;
      rt.user.name = arobase;
      // @ts-ignore
      rt.retweeted = true;

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

  protected async initClassic() {
    this.state = "user_read";
    const js_dir = this.archive.dir('data').dir('js');

    const index: ClassicTweetIndex = await js_dir.get('tweet_index.js');
    const payload: ClassicPayloadDetails = await js_dir.get('payload_details.js');
    const user: TwitterUserDetails = await js_dir.get('user_details.js');

    this.index.info = user;
    this.index.archive = payload;

    this.dispatchEvent({type: 'userinfosready'});

    const files_to_read = index.map(e => e.file_name);

    let tweets: PartialTweet[] = [];

    this.state = "tweet_read";
    const tweet_file_promises: Promise<void>[] = [];

    for (const file of files_to_read) {
      tweet_file_promises.push(
        this.archive.get(file).then((t: PartialTweet[]) => {
          tweets.push(...t);
        })
      );
    }
    
    await Promise.all(tweet_file_promises);

    // Tri les tweets par ID (le plus récent, plus grand en premier)
    tweets = tweets.sort((a, b) => {
      return Number(BigInt(b.id_str) - BigInt(a.id_str));
    });

    this.dispatchEvent({type: 'tweetsread'});

    this.state = "indexing";
    // Build index (read tweets)
    for (let i = 0; i < tweets.length; i++) {
      const date = new Date(tweets[i].created_at);

      const month = String(date.getMonth() + 1);
      const year = String(date.getFullYear());

      // Creating month/year if not presents
      if (!(year in this.index.years)) {
        this.index.years[year] = {};
      }

      if (!(month in this.index.years[year])) {
        this.index.years[year][month] = {};
      }

      // Save tweet in index
      this.index.years[year][month][tweets[i].id_str] = tweets[i];
      this.index.by_id[tweets[i].id_str] = tweets[i];
    }

    // Setting right tweet number
    this.index.archive.tweets = Object.keys(this.index.by_id).length;

    this.dispatchEvent({type: 'indexready'});
    this.state = "ready";
  }

  protected isGDPRArchive() {
    return this._is_gdpr = this.archive.search(/^tweets\.csv$/).length === 0;
  }

  /**
   * True if given tweet is coming from a GDPR archive.
   * 
   * Tweets getted by available getters are NOT GDPR tweets, they've been converted !
   */
  isGDPRTweet(tweet: PartialTweetGDPR): true;
  isGDPRTweet(tweet: PartialTweet): false;

  isGDPRTweet(tweet: PartialTweetGDPR | PartialTweet) : boolean {
    return 'retweet_count' in tweet;
  }

  /** Extract tweets from a specifc month. */
  month(month: string, year: string) : PartialTweet[] {
    if (year in this.index.years) {
      if (month in this.index.years[year]) {
        return Object.values(this.index.years[year][month]);
      }
    }

    return [];
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
  id(id_str: string) : PartialTweet | null {
    if (id_str in this.index.by_id) {
      return this.index.by_id[id_str];
    }

    return null;
  }

  /** Give the media url in direct message, obtain the Blob-bed image. */
  dmImageFromUrl(url: string, is_group = false) {
    const [, , , , id, , image] = url.split('/');

    if (id && image) {
      return this.dmImage(id + "-" + image, is_group)
    }
    return Promise.reject();
  }

  /** Extract a direct message image from GDPR archive (exact filename required). */
  dmImage(name: string, is_group = false) : Promise<Blob> {
    if (!this.is_gdpr) {
      return Promise.reject("Archive not supported");
    }

    const directory = this.archive.dir(
      is_group ? "direct_message_group_media" : "direct_message_media"
    );

    const results = directory.search(new RegExp(name + "\.(.+)$"));

    if (results) {
      return this.archive.read(results[0], "blob");
    }
    return Promise.reject("File not found");
  }

  /** All tweets registered in this archive. */
  get all() : PartialTweet[] {
    return Object.values(this.index.by_id);
  }

  /** Access to the DMArchive object. Will be undefined if `.is_gdpr === false`. */
  get messages() {
    return this.dms;
  }

  /** ID of the user who created this archive. */
  get owner() {
    return this._index.info.id;
  }

  /** 
   * Screen name (@) of the user who created this archive.
   * May be obsolete (user can change screen_name over time).
   */
  get owner_screen_name() {
    return this._index.info.screen_name;
  }

  /** Archive creation date. Not accurate in GDPR archive (will be the current date). */
  get generation_date() {
    return new Date(this._index.archive.created_at);
  }

  /** Archive information and tweet index. */
  get index() {
    return this._index;
  }

  /** Number of tweets in this archive. */
  get length() {
    return this.index.archive.tweets;
  }

  /** True if archive is a GDPR archive. */
  get is_gdpr() {
    return this._is_gdpr;
  }

  /** Resolved when archive read is over. */
  ready() {
    return this._ready;
  }
}

// Define onevents
defineEventAttribute(TwitterArchive.prototype, "zipready");
defineEventAttribute(TwitterArchive.prototype, "userinfosready");
defineEventAttribute(TwitterArchive.prototype, "tweetsread");
defineEventAttribute(TwitterArchive.prototype, "indexready");
defineEventAttribute(TwitterArchive.prototype, "willreaddm");
defineEventAttribute(TwitterArchive.prototype, "willreadextended");
defineEventAttribute(TwitterArchive.prototype, "ready");
defineEventAttribute(TwitterArchive.prototype, "error");
