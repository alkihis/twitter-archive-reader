import JSZip from 'jszip';
import { ArchiveIndex, PartialTweetGDPR, PartialTweet, AccountGDPR, ProfileGDPR, ClassicTweetIndex, ClassicPayloadDetails, TwitterUserDetails, DMFile, PartialTweetUser } from './TwitterTypes';
import DMArchive from './DMArchive';

export function dateFromTweet(tweet: PartialTweet) : Date {
  if (tweet.created_at_d) {
    return tweet.created_at_d;
  }
  return tweet.created_at_d = new Date(tweet.created_at);
}

export function isWithMedia(tweet: PartialTweet) {
  return tweet.entities.media.length > 0;
}

export function isWithVideo(tweet: PartialTweet) {
  if (tweet.extended_entities) {
    if (tweet.extended_entities.media) {
      return tweet.extended_entities.media.some(m => m.type !== "photo");
    }
  }

  return false;
}

export type AcceptedZipSources = string | number[] | Uint8Array | ArrayBuffer | Blob | NodeJS.ReadableStream | JSZip;

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

export class TwitterArchive {
  protected _ready: Promise<void> = Promise.resolve();
  protected archive: Archive;

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

  constructor(file: AcceptedZipSources) {
    this.archive = new Archive(file);
    this._ready = this.archive.ready()
      .then(() => {
        // Initialisation de l'archive Twitter
        if (this.isGDPRArchive()) {
          return this.initGDPR();
        }
        else {
          return this.initClassic();
        }
      });
  }

  protected async initGDPR() {
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

    // Init tweet indexes
    const tweets: PartialTweetGDPR[] = await this.archive.get('tweet.js');

    let i = 1;
    while (this.archive.has(`tweet-part${i}.js`)) {
      // Add every tweet in other files 
      // inside a "new" array in the initial array
      tweets.push(...(await this.archive.get(`tweet-part${i}.js`)));
      i++;
    }

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

    // Register info
    this._index.archive.tweets = tweets.length;

    // Init DMs
    this.dms = new DMArchive(this.owner);
    
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

    if (rt_data && rt_data.length) {
      const [, arobase, text] = rt_data;
      const rt = Object.assign({}, tweet) as unknown as PartialTweet;
      rt.user = Object.assign({}, rt.user);

      rt.text = text;
      rt.user.screen_name = arobase;
      rt.user.name = arobase;

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
    const js_dir = this.archive.dir('data').dir('js');

    const index: ClassicTweetIndex = await js_dir.get('tweet_index.js');
    const payload: ClassicPayloadDetails = await js_dir.get('payload_details.js');
    const user: TwitterUserDetails = await js_dir.get('user_details.js');

    this.index.info = user;
    this.index.archive = payload;

    const files_to_read = index.map(e => e.file_name);

    const tweets: PartialTweet[] = [];

    for (const file of files_to_read) {
      tweets.push(...await this.archive.get(file) as PartialTweet[]);
    }

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
  }

  protected isGDPRArchive() {
    return this._is_gdpr = this.archive.search(/^tweets\.csv$/).length === 0;
  }

  isGDPRTweet(tweet: PartialTweetGDPR): true;
  isGDPRTweet(tweet: PartialTweet): false;

  isGDPRTweet(tweet: PartialTweetGDPR | PartialTweet) : boolean {
    return 'retweet_count' in tweet;
  }

  month(month: string, year: string) : PartialTweet[] {
    if (year in this.index.years) {
      if (month in this.index.years[year]) {
        return Object.values(this.index.years[year][month]);
      }
    }

    return [];
  }

  // TODO TESTER
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

  id(id_str: string) : PartialTweet | null {
    if (id_str in this.index.by_id) {
      return this.index.by_id[id_str];
    }

    return null;
  }

  get all() : PartialTweet[] {
    return Object.values(this.index.by_id);
  }

  /** Access to the DMArchive */
  get messages() {
    return this.dms;
  }

  /** ID of the user who created this archive */
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

  /** Not accurate in GDPR archive (will be the current date) */
  get generation_date() {
    return new Date(this._index.archive.created_at);
  }

  get index() {
    return this._index;
  }

  get length() {
    return this.index.archive.tweets;
  }

  get is_gdpr() {
    return this._is_gdpr;
  }

  ready() {
    return this._ready;
  }
}
