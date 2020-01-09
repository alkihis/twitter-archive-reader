import { AcceptedZipSources, Archive, BaseArchive, constructArchive } from './StreamArchive';
import { ArchiveIndex, PartialTweetGDPR, PartialTweet, AccountGDPR, ProfileGDPR, ClassicTweetIndex, ClassicPayloadDetails, TwitterUserDetails, DMFile, PartialTweetUser, GDPRFollowings, GDPRFollowers, GDPRFavorites, GDPRMutes, InnerGDPRPersonalization, GPDRScreenNameHistory, GPDRProtectedHistory, GDPRBlocks, GDPRAgeInfo, InnerGDPRAgeInfo, GDPRMoment, GDPRMomentFile, DirectMessage, BasicArchiveIndex, LinkedDirectMessage, GDPRConversation, ArchiveSave, ArchiveSaveInfo } from './TwitterTypes';
import DMArchive from './DMArchive';
import { EventTarget, defineEventAttribute } from 'event-target-shim';
import bigInt from 'big-integer';
import { supportsBigInt } from './helpers';
import JSZip from 'jszip';
import Conversation from './Conversation';
import md5 from 'js-md5';

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
  if (tweet.created_at_d && tweet.created_at_d instanceof Date) {
    return tweet.created_at_d;
  }
  return tweet.created_at_d = parseTwitterDate(tweet.created_at);
}

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
  protected archive: BaseArchive<any>;

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

  protected dm_img_archive: BaseArchive<any>;
  protected dm_img_group_archive: BaseArchive<any>;

  protected _is_gdpr = false;

  protected user_cache: PartialTweetUser;

  /**
   * Build a new instance of TwitterArchive.
   * 
   * @param file Accept any source that `JSZip` library accepts, and string for filenames. 
   * If this parameter is `null`, then you'll need to load each part one by one !
   * @param build_extended True if `.extended_gdpr` should be built (only if **file** is a GDPR archive.)
   * @param keep_loaded If possible, free the memory after load if set to false.
   * @param load_images_in_zip In Twitter GDPR archives v2, tweet and dm images are in ZIP archives inside the ZIP.
   * If `true`, TwitterArchive will extract its content in RAM to allow the usage of images.
   * If `false`, DMs images will be unavailable.
   * If `undefined`, Twitter will extract in RAM in browser mode, and leave the ZIP untouched in Node.js.
   * 
   * If you want to save memory, set this parameter to `false`, 
   * and before using `.dmImage()` methods, check if you need to load DM images ZIP 
   * with `.requiresDmImageZipLoad()`.
   * 
   * Then, if you need to, load the DM image ZIP present in the archive using `.loadCurrentDmImageZip()`. 
   * **Please note that `keep_loaded` should be set to `true` to use this method !**
   */
  constructor(
    file: AcceptedZipSources | Promise<AcceptedZipSources> | null, 
    build_extended = true, 
    keep_loaded = false,
    protected load_images_in_zip: boolean = undefined,
  ) {
    super();

    if (file === null) {
      this.state = "ready";
    }
    else {
      this.state = "reading";
  
      this._ready = 
        (file instanceof Promise ? 
          file.then(f => (this.archive = constructArchive(f)).ready())
          : (this.archive = constructArchive(file)).ready()
        )
        .then(() => {
          this.dispatchEvent({ type: 'zipready' });
  
          // Initialisation de l'archive Twitter
          if (this.isGDPRArchive()) {
            return this.initGDPR(build_extended, keep_loaded);
          }
          else {
            return this.initClassic().then(() => {
              if (!keep_loaded) {
                this.archive = undefined;
              }
            });
          }
        })
        .then(() => {
          this.dispatchEvent({ type: 'ready' });
        })
        .catch(e => {
          this.dispatchEvent({ type: 'error', detail: e });
          return Promise.reject(e);
        });
    }
  }

  protected async initGDPR(extended: boolean, keep_loaded: boolean) {
    try {
      // Delete the tweet media folder (big & useless)
      if (this.archive instanceof Archive) {
        this.archive.raw.remove('tweet_media');
      }
    } catch (e) { }

    // This is not accurate, but this is for compatibility reasons
    this.dispatchEvent({ type: 'userinfosready' });
  
    this.state = "tweet_read";


    // ------------------------
    // TWEETS AND PROFILE INFOS
    // ------------------------

    // Init tweet indexes
    const tweets: PartialTweetGDPR[] = await this.archive.get('tweet.js');

    let i = 1;
    while (this.archive.has(`tweet-part${i}.js`)) {
      // Add every tweet in other files 
      // inside a "new" array in the initial array
      tweets.push(...await this.archive.get(`tweet-part${i}.js`));
      i++;
    }

    this.dispatchEvent({ type: 'tweetsread' });

    this.loadArchivePart({
      account: await this.archive.get('account.js'),
      profile: await this.archive.get('profile.js'),
      tweets
    });

    this.dispatchEvent({ type: 'indexready' });


    // ---------------
    // DIRECT MESSAGES
    // ---------------

    this.state = "dm_read";
    this.dispatchEvent({ type: 'willreaddm' });
    
    // Init DMs
    const conv_files = ['direct-message.js', 'direct-message-group.js'];

    i = 1;
    while (this.archive.has(`direct-message-part${i}.js`)) {
      conv_files.push(`direct-message-part${i}.js`);
      i++;
    }

    this.loadArchivePart({
      dms: await Promise.all(
        conv_files
          .filter(name => this.archive.has(name))
          .map(file => this.archive.get(file))
      ),
    });
    // DMs should be ok

    // Test if archive contain DM images as zip
    let can_unload_archive = !keep_loaded;

    if (this.archive.searchDir(/direct_message_media/).length) {
      const folder = this.archive.dir('direct_message_media');
      const query = folder.search(/\.zip$/);
      if (query.length) {
        // console.log("Creating archive from archive (single)");
        if (this.should_autoload_zip_img)
          this.dm_img_archive = await folder.fromFile(query[0]);
      }
      else {
        // cannot unload
        can_unload_archive = false;
      }
    }
    if (this.archive.searchDir(/direct_message_group_media/).length) {
      const folder = this.archive.dir('direct_message_group_media');
      const query = folder.search(/\.zip$/);
      if (query.length && this.should_autoload_zip_img) {
        // console.log("Creating archive from archive (group)");
        this.dm_img_group_archive = await folder.fromFile(query[0]);
      }
    }

    this.state = "extended_read";
    this.dispatchEvent({ type: 'willreadextended' });

    if (extended) {
      await this.initExtendedGDPR();
    }
    this.state = "ready";

    if (can_unload_archive) {
      this.archive = undefined;
    }
  }

  protected async initExtendedGDPR() {
    // Followings
    const followings = new Set<string>();
    
    try {
      const f_following: GDPRFollowings = await this.archive.get('following.js');
      for (const f of f_following) {
        followings.add(f.following.accountId);
      }
    } catch (e) { }

    // Followers
    const followers = new Set<string>();

    try {
      const f_follower: GDPRFollowers = await this.archive.get('follower.js');
      for (const f of f_follower) {
        followers.add(f.follower.accountId);
      }
    } catch (e) { }

    // Favorites
    const favorites = new Set<string>();
    
    try {
      const f_fav: GDPRFavorites = await this.archive.get('like.js');
      for (const f of f_fav) {
        favorites.add(f.like.tweetId);
      }
    } catch (e) { }

    // Mutes
    const mutes = new Set<string>();

    try {
      const f_mutes: GDPRMutes = await this.archive.get('mute.js');
      for (const f of f_mutes) {
        mutes.add(f.muting.accountId);
      }
    } catch (e) { }

    // Blocks
    const blocks = new Set<string>();

    try {
      const f_block: GDPRBlocks = await this.archive.get('block.js');
      for (const f of f_block) {
        blocks.add(f.blocking.accountId);
      }
    } catch (e) { }

    // Lists
    const lists : {
      created: string[];
      member_of: string[];
      subscribed: string[];
    } = {
      created: [],
      member_of: [],
      subscribed: []
    };

    try {
      lists.created = (await this.archive.get('lists-created.js'))[0].userListInfo.urls;
      lists.member_of = (await this.archive.get('lists-member.js'))[0].userListInfo.urls;
      lists.subscribed = (await this.archive.get('lists-subscribed.js'))[0].userListInfo.urls;
    } catch (e) { }

    // Personalization
    let personalization: InnerGDPRPersonalization = { 
      demographics: undefined, 
      locationHistory: [],  
      interests: undefined 
    };
    try {
      personalization = (await this.archive.get('personalization.js'))[0].p13nData;
    } catch (e) { }

    let age_info: InnerGDPRAgeInfo;
    try {
      age_info = (await this.archive.get('ageinfo.js') as GDPRAgeInfo)[0].ageMeta;
    } catch (e) { }

    // SN history
    const screen_name_history: GPDRScreenNameHistory[] = [];
    
    try {
      const f_history = await this.archive.get('screen-name-change.js') as { screenNameChange: GPDRScreenNameHistory }[];
      for (const e of f_history) {
        screen_name_history.push(e.screenNameChange);
      }
    } catch (e) { }

    // Protected history
    const protected_history: GPDRProtectedHistory[] = [];

    try {
      const f_phistory = await this.archive.get('protected-history.js') as { protectedHistory: GPDRProtectedHistory }[];
      for (const e of f_phistory) {
        protected_history.push(e.protectedHistory);
      }
    } catch (e) { }

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

  protected async initClassic() {
    this.state = "user_read";
    const js_dir = this.archive.dir('data').dir('js');

    const index: ClassicTweetIndex = await js_dir.get('tweet_index.js');

    this.loadClassicArchivePart({
      payload: await js_dir.get('payload_details.js'), 
      user: await js_dir.get('user_details.js'),
    });

    this.dispatchEvent({ type: 'userinfosready' });

    const files_to_read = index.map(e => e.file_name);

    this.state = "tweet_read";
    const tweet_file_promises: Promise<PartialTweet[]>[] = [];

    for (const file of files_to_read) {
      tweet_file_promises.push(this.archive.get(file));
    }
    
    let tweets: PartialTweet[] = [].concat(...await Promise.all(tweet_file_promises));

    // Tri les tweets par ID (le plus récent, plus grand en premier)
    tweets = this.sortTweets(tweets);

    this.dispatchEvent({ type: 'tweetsread' });

    this.state = "indexing";
    // Build index (read tweets)
    this.readTweets(tweets);

    this.dispatchEvent({ type: 'indexready' });
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
  isGDPRTweet(tweet: PartialTweetGDPR | PartialTweet) : tweet is PartialTweetGDPR {
    return 'retweet_count' in tweet;
  }

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
      const d = dateFromTweet(t);
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

  /** 
   * Give the media url in direct message, obtain the Blob-bed image. 
   * For use in Node.js, you must set `as_array_buffer` to `true` ! 
   */
  dmImageFromUrl(url: string, is_group = false, as_array_buffer = false) {
    const [, , , , id, , image] = url.split('/');

    if (id && image) {
      return this.dmImage(id + "-" + image, is_group, as_array_buffer)
    }
    return Promise.reject("URL is invalid");
  }

  /** 
   * Extract a direct message image from GDPR archive (exact filename required). 
   * For use in Node.js, you must set `as_array_buffer` to `true` ! 
   */
  dmImage(name: string, is_group = false, as_array_buffer = false) : Promise<Blob | ArrayBuffer> {
    if (!this.is_gdpr) {
      return Promise.reject("Archive not supported");
    }

    if (this.dm_img_archive || this.dm_img_group_archive) {
      // Les dm sont dans un ZIP
      let zip: BaseArchive<any>;
      if (is_group) {
        zip = this.dm_img_group_archive;
      }
      else {
        zip = this.dm_img_archive;
      }

      if (!zip) {
        return Promise.reject("Image archive is not loaded, impossible to get media.");
      }

      const results = zip.search(new RegExp(name + "(\.?.*)$"));
  
      if (results.length) {
        return zip.read(results[0], as_array_buffer ? "arraybuffer" : "blob");
      }
      return Promise.reject("File not found");
    }
    else {
      if (!this.archive) {
        return Promise.reject("Archive is not available/loaded: DM images are not fetchables");
      }

      const directory = this.archive.dir(
        is_group ? "direct_message_group_media" : "direct_message_media"
      );
  
      const results = directory.search(new RegExp(name + "(\.?.*)$"));
  
      if (results.length) {
        return this.archive.read(results[0], as_array_buffer ? "arraybuffer" : "blob");
      }
      return Promise.reject("File not found");
    }
  }

  /**
   * Return all the images of a direct message, as blob or array buffer.
   * 
   * If the message does not exists or the DM archive is not loaded / available,
   * return an empty array.
   * 
   * Otherwise, return a array of `Blob` / `ArrayBuffer`
   * 
   * @param direct_message Direct Message id | Direct message
   * @param as_array_buffer Return an `ArrayBuffer` array, instead of a `Blob` array
   */
  async dmImagesOf(direct_message: string | DirectMessage, as_array_buffer = false): Promise<(Blob | ArrayBuffer)[]> {
    if (!this.is_gdpr || !this.messages) {
      return [];
    }

    if (typeof direct_message === 'string') {
      direct_message = this.messages.single(direct_message);
    }

    if (!direct_message) {
      // Message not found
      return [];
    }

    const images: Promise<Blob | ArrayBuffer>[] = [];
    for (const media of direct_message.mediaUrls) {
      images.push(this.dmImageFromUrl(media, as_array_buffer));
    }

    return Promise.all(images);
  }

  /**
   * Return true if you need to load a DM image ZIP in order to use `.dmImage()`.
   * 
   * If you need to, see `.loadCurrentDmImageZip()`, or `importDmImageZip()`.
   */
  requiresDmImageZipLoad() {
    if (!this.is_gdpr || !this.archive || this.dm_img_archive) {
      return false;
    }

    if (this.archive.searchDir(new RegExp('direct_message_media')).length) {
      const folder = this.archive.dir('direct_message_media');
      const query = folder.search(/\.zip$/);
      if (query.length) {
        return true;
      }
    }

    return false;
  }

  /**
   * Load/reload zip archives that contains DM images, 
   * if `load_images_in_zip` parameter was set to false.
   * 
   * You need to have the archive loaded to accomplish this action 
   * (constructor `keep_loaded` parameter should be set to `true`).
   * 
   * Note that if any zip is found in the archive, this method will just do nothing.
   */
  async loadCurrentDmImageZip() {
    if (!this.archive || !this.is_gdpr) {
      return;
    }

    if (this.archive.searchDir(new RegExp('direct_message_media')).length) {
      const folder = this.archive.dir('direct_message_media');
      const query = folder.search(/\.zip$/);
      if (query.length) {
        // Load the archive
        this.dm_img_archive = await folder.fromFile(query[0]);
        await this.dm_img_archive.ready();
      }
    }
    if (this.archive.searchDir(new RegExp('direct_message_group_media')).length) {
      const folder = this.archive.dir('direct_message_group_media');
      const query = folder.search(/\.zip$/);
      if (query.length) {
        // Load the archive (group)
        this.dm_img_group_archive = await folder.fromFile(query[0]);
        await this.dm_img_group_archive.ready();
      }
    }
  }

  /**
   * Import a custom ZIP file as DM single-conversation images file.
   */
  async importDmImageZip(file: AcceptedZipSources | Promise<AcceptedZipSources>) {
    this.dm_img_archive = constructArchive(await file);
    await this.dm_img_archive.ready();
  }

  /**
   * Import a custom ZIP file as DM group-conversation images file.
   */
  async importDmGroupImageZip(file: AcceptedZipSources | Promise<AcceptedZipSources>) {
    this.dm_img_group_archive = constructArchive(await file);
    await this.dm_img_group_archive.ready();
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
    return parseTwitterDate(this._index.archive.created_at);
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
    if (this._is_gdpr === undefined)
      return this.isGDPRArchive();
    return this._is_gdpr;
  }

  /** Raw Archive object. Can be used to get specific files. */
  get raw() {
    return this.archive;
  }

  protected get should_autoload_zip_img() {
    if (typeof this.load_images_in_zip !== 'undefined') {
      return this.load_images_in_zip;
    }

    // test if node
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      // IsNode
      return false;
    }
    return true;
  }

  /** Resolved when archive read is over. */
  ready() {
    return this._ready;
  }


  /** -------------------- */
  /** SIDELOADING MANUALLY */
  /** -------------------- */
  
  /**
   * Load a part of a GDPR archive.
   * 
   * Set current archive as GDPR archive.
   */
  loadArchivePart(parts: {
    tweets?: PartialTweetGDPR[],
    account?: AccountGDPR,
    profile?: ProfileGDPR,
    dms?: DMFile[],
  } = {}) {
    this._is_gdpr = true;

    if (parts.account) {
      // Init informations
      const account = parts.account[0].account;
      
      this._index.info.screen_name = account.username;
      this._index.info.full_name = account.accountDisplayName;
      this._index.info.id = account.accountId;
      this._index.info.created_at = account.createdAt;
    }
    if (parts.profile) {
      const profile = parts.profile[0].profile;

      this._index.info.location = profile.description.location;
      this._index.info.bio = profile.description.bio;
      this._index.info.profile_image_url_https = profile.avatarMediaUrl;
    }
    if (parts.tweets) {
      this.readGDPRTweets(parts.tweets, this.index.info.profile_image_url_https);
    }
    if (parts.dms) {
      if (!this.dms) {
        this.dms = new DMArchive(this.owner);
      }
      
      for (const file of parts.dms) {
        this.dms.add(file);
      }
    }
  }

  /**
   * Load a part of a classic archive.
   * 
   * Set current archive as non-gdpr archive.
   */
  loadClassicArchivePart(parts: {
    tweets?: PartialTweet[],
    payload?: ClassicPayloadDetails,
    user?: TwitterUserDetails,
  } = {}) {
    this._is_gdpr = false;

    if (parts.tweets) {
      this.readTweets(this.sortTweets(parts.tweets));
    }
    if (parts.user) {
      this.index.info = parts.user;
    }
    if (parts.payload) {
      this.index.archive = parts.payload;
    }
  }

  /**
   * Convert GDPR tweets into classic tweets, then register them into the index.
   */
  protected readGDPRTweets(tweets: PartialTweetGDPR[], profile_img_https: string) {
    // Build index
    for (let i = 0; i < tweets.length; i++) {
      const date = parseTwitterDate(tweets[i].created_at);

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
      const converted = this.convertToPartial(tweets[i], profile_img_https);
      this.index.years[year][month][tweets[i].id_str] = converted;
      this.index.by_id[tweets[i].id_str] = converted;
    }

    // Setting right tweet number
    this.index.archive.tweets = Object.keys(this.index.by_id).length;
  }

  /**
   * Register tweets into the index.
   */
  protected readTweets(tweets: PartialTweet[]) {
    // Build index (read tweets)
    for (let i = 0; i < tweets.length; i++) {
      const date = dateFromTweet(tweets[i]);

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
  }

  /**
   * Sort tweets by ID.
   */
  protected sortTweets(tweets: PartialTweet[]) {
    if (supportsBigInt()) {
      return tweets.sort((a, b) => Number(BigInt(b.id_str) - BigInt(a.id_str)));
    }
    else {
      return tweets.sort((a, b) => (bigInt(b.id_str).minus(bigInt(a.id_str))).toJSNumber());
    }
  }

  /** --------------------- */
  /** ARCHIVE EXPORT / LOAD */
  /** --------------------- */
  async exportSave() : Promise<ArchiveSave> {
    const info = this.archive_save_info;
    info.hash = this.hash(info);

    function convertConversationToGDPRConversation(conversation: Conversation) : GDPRConversation {
      return {
        dmConversation: {
          conversationId: conversation.id,
          messages: conversation.all
            .map(message => ({
              messageCreate: {
                recipientId: message.recipientId,
                createdAt: message.createdAt,
                mediaUrls: message.mediaUrls,
                text: message.text,
                senderId: message.senderId,
                id: message.id
              }
            }))
        }
      };
    }

    // Remove the real archive index
    // @ts-ignore
    delete info.index.years;
    // @ts-ignore
    delete info.index.by_id;

    const tweets = this.all;
    for (const tweet of tweets) {
      delete tweet.created_at_d;
    }

    const tweet_zip = await new JSZip().file("tweet.json", JSON.stringify(tweets)).generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6 // Not too much, if we want a good generation time
      }
    });

    const mutes = this.extended_gdpr ? [...this.extended_gdpr.mutes] : [];
    const blocks = this.extended_gdpr ? [...this.extended_gdpr.blocks] : [];

    let dms: ArrayBuffer = null;
    if (this.is_gdpr && this.messages) {
      // Swallow copy all the dms, save them to a JSZip instance
      /* 
        dm.json => [
          GDPRConversation,
          ...
        ]
      */

      dms = await new JSZip()
        .file(
          "dm.json", 
          JSON.stringify(this.messages.all.map(convertConversationToGDPRConversation))
        )
        .generateAsync({
          type: "arraybuffer",
          compression: "DEFLATE",
          compressionOptions: {
            level: 6 // Not too much, if we want a good generation time
          }
        });
    }

    return {
      tweets: tweet_zip,
      dms,
      info,
      mutes,
      blocks,
      screen_name_history: this.extended_gdpr ? this.extended_gdpr.screen_name_history : []
    };
  }

  get archive_save_info() {
    const info: ArchiveSaveInfo = {
      index: { ...this._index },
      is_gdpr: this.is_gdpr,
      version: "1.0.0",
      last_tweet_date: "",
      hash: "",
      tweet_count: this.length,
      dm_count: this.messages ? this.messages.count : 0,
    };

    let last_date = 0;
    for (const tweet of this.all) {
      const cur_date = dateFromTweet(tweet).getTime();
      if (cur_date > last_date) {
        last_date = cur_date;
      }
    }

    info.last_tweet_date = new Date(last_date ? last_date : Date.now()).toString();

    return info;
  }

  hash(from?: ArchiveSaveInfo) {
    const info = from ? from : this.archive_save_info;

    return md5(JSON.stringify({
      screen_name: info.index.info.screen_name,
      bio: info.index.info.bio,
      name: info.index.info.full_name,
      profile_image_url_https: info.index.info.profile_image_url_https,
      created_at: info.index.info.created_at,
      tweets: info.tweet_count,
      dms: info.dm_count,
      last_tweet_date: info.last_tweet_date,
      id: info.index.info.id,
      location: info.index.info.location,
    }));
  }

  protected static readonly SUPPORTED_SAVE_VERSIONS = ["1.0.0"];

  static async importSave(save: ArchiveSave | Promise<ArchiveSave>) {
    save = await save;

    if (!this.SUPPORTED_SAVE_VERSIONS.includes(save.info.version)) {
      throw new Error("Save version is not supported.");
    }

    const archive = new TwitterArchive(null);

    archive._index.archive = save.info.index.archive;
    archive._index.info = save.info.index.info;

    const tweet_archive = await JSZip.loadAsync(save.tweets);
    let current_load_object = JSON.parse(await tweet_archive.file("tweet.json").async("text"));

    archive.readTweets(current_load_object);

    current_load_object = undefined;
    archive._is_gdpr = save.info.is_gdpr;

    if (save.dms) {
      const dm_archive = await JSZip.loadAsync(save.dms);
      current_load_object = JSON.parse(await dm_archive.file("dm.json").async("text")) as DMFile;

      archive.loadArchivePart({
        dms: [current_load_object]
      });
    }
    if (archive.is_gdpr) {
      archive.extended_gdpr = {
        followers: new Set,
        followings: new Set,
        mutes: new Set(save.mutes),
        blocks: new Set(save.blocks),
        personalization: undefined,
        favorites: new Set,
        lists: {
          created: [],
          member_of: [],
          subscribed: []
        },
        screen_name_history: save.screen_name_history,
        protected_history: [],
        age_info: undefined,
        moments: []
      };
    }

    return archive;
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
