import { AcceptedZipSources, constructArchive, ConstructibleArchives } from './reading/StreamArchive';
import DMArchive from './direct_messages/DMArchive';
import { EventEmitter } from 'events';
import md5 from 'js-md5';
import TweetArchive from './tweets/TweetArchive';
import { FavoriteArchive } from './tweets/FavoriteArchive';
import UserData from './user/UserData';
import AdArchive from './user/AdArchive';
import MediaArchive from './MediaArchive';
import { parseTwitterDate, dateFromTweet, sortTweets } from './utils/exported_helpers';
import { ExtendedInfoContainer, TwitterArchiveLoadOptions, BasicArchiveInfo, ArchiveSyntheticInfo } from './types/Internal';
import { PartialTweetGDPR } from './types/GDPRTweets';
import { GDPRFollowings, GDPRFollowers, GDPRFavorites, GDPRMutes, GDPRBlocks, PartialFavorite } from './types/GDPRExtended';
import { GDPRMoment, GDPRMomentFile } from './types/GDPRMoments';
import { ClassicTweetIndex, ClassicPayloadDetails } from './types/ClassicPayloadIndex';
import { PartialTweet, TwitterUserDetails } from './types/ClassicTweets';
import { AccountGDPR, ProfileGDPR } from './types/GDPRAccount';
import { DMFile } from './types/GDPRDMs';
import { TweetFileError, DirectMessageParseError, ProfileFileError, AccountFileError } from './utils/Errors';
import Settings from './utils/Settings';
import { sleep } from './utils/helpers';


// Base variables, unexported
function getExtendedContainerBase() : ExtendedInfoContainer {
  return {
    followers: new Set,
    followings: new Set,
    moments: [],
    lists: {
      created: [],
      member_of: [],
      subscribed: [],
    },
    mutes: new Set,
    blocks: new Set,
  };
}

export type ArchiveReadState = "idle" | "reading" | "indexing" | "tweet_read" | "user_read" | "dm_read" | "extended_read" | "ready";
/** Read steps fired in `'read'` event. */
export type ArchiveReadStep = "zipready" | "userinfosready" | "tweetsread" | "indexready" | "willreaddm" | "willreadextended";

export type ArchiveReadPart = "tweet" | "dm" | "follower" | "following" | "mute" | "block" | "favorite" | "list" | "moment" | "ad";


/**
 * Represents a full Twitter Archive. Support GDPR and classic archive.
 * 
 * You can check if the archive is a GDPR archive with property `.is_gdpr`.
 * 
 * Available on both GDPR and old classic archives
 * -----
 * Tweets, that are available in `.tweets`.
 * Remember that, in searchs in particular, tweets are **NOT** sorted.
 * 
 * Quick user information, like screen name, bio, location, ID and account
 * creation date is available through `.user[.summary]`.
 *
 * 
 * Available on GDPR archives only
 * -----
 * Favorites, mutes, blocks, followings, followers, that are stored in 
 * `.favorites`, `.mutes`, `.blocks`, `.followings` and `.followers`.
 * 
 * Direct messages, parsed if archive is a GDPR archive, stored in `.messages`, 
 * are returned and sorted from the most older to the more recent.
 * 
 * Medias stored in archives are in `.medias`.
 * 
 * User detailled data (screen name history, email address) is in `.user` property.
 * 
 * Quick start
 * -----
 * 
 * Initialize a `TwitterArchive` object with a filepath, `Blob`, `ArrayBuffer` or `Uint8Array` objects.
 * 
 * Then, you could add events in order to know archive read steps. 
 * Finally, wait for ready-ness of the object, and use it !
 * 
 * ```ts
 * import TwitterArchive, { ArchiveReadStep } from 'twitter-archive-reader';
 * 
 * // From a local file
 * const archive = new TwitterArchive('filepath.zip');
 * // or file input (browser)
 * const archive = new TwitterArchive(document.querySelector('input[type="file"]').files[0]);
 * 
 * // Listen for archive steps to give feedback to user
 * archive.events.on('read', ({ step }: { step: ArchiveReadStep }) => {
 *  console.log("Archive reading step:", step);
 * });
 * 
 * // Wait for ready-ness
 * await archive.ready();
 * console.log("Archive is ready !");
 * ```
 */
export class TwitterArchive {
  // Export the settings as static property of default exported object
  public static readonly settings = Settings;

  protected _ready: Promise<void> = Promise.resolve();
  protected archive: ConstructibleArchives;

  /** Current archive load state. */
  public state: ArchiveReadState = "idle";
  /** Where events about archive read are emitted. */
  public readonly events = new EventEmitter;

  protected _tweets = new TweetArchive;
  protected _messages: DMArchive;
  protected _favorites = new FavoriteArchive;
  protected extended_info_container = getExtendedContainerBase();
  protected _user = new UserData;
  protected _ads = new AdArchive;
  protected _medias = new MediaArchive(undefined);

  protected _is_gdpr: boolean;
  protected _created_at = new Date().toISOString();

  /**
   * Twitter Archive constructor.
   * 
   * Don't forget to await the archive ready-ness with `.ready()` method !
   * 
   * ```ts
   * // From a local file
   * const archive = new TwitterArchive('filepath.zip');
   * // or file input (browser)
   * const archive = new TwitterArchive(document.querySelector('input[type="file"]').files[0]);
   * 
   * await archive.ready();
   * ```
   * 
   * @param file Archive to load.
   * 
   * If you want to build an archive instance **without** a file, you can pass `null` here.
   * You must then load parts of the archive with `.loadArchivePart()` or `.loadClassicArchivePart()` !
   *
   * @param options.ignore
   * Specify if you want to ignore a specific part of archive, for performance or memory reasons.
   * 
   * Available parts are in `ArchiveReadPart` type.
   * 
   * By default, all parts are imported from archive.
   * If you want to ignore every part, you can specify `"*"` in the part array.
   * 
   * **Profile and account data is always parsed.**
   * 
   * ```ts
   * type ArchiveReadPart = "tweet" | "dm" | "follower" | "following" | "mute" | "block" | "favorite" | "list" | "moment" | "ad";
   * ```
   */
  constructor(
    file: AcceptedZipSources | Promise<AcceptedZipSources> | null, 
    options: TwitterArchiveLoadOptions = {}
  ) {
    let PARTS_TO_READ = new Set<ArchiveReadPart>(["tweet", "dm", "follower", "following", "mute", "block", "favorite", "list", "moment", "ad"]);

    if (options && options.ignore) {
      if (options.ignore.includes("*")) {
        // Ignore everything
        PARTS_TO_READ.clear();
      }
      else {
        // Keep the non-ignored parts
        for (const e of options.ignore) {
          // @ts-ignore
          PARTS_TO_READ.delete(e);
        }
      }
    }

    if (file === undefined) {
      throw new TypeError("File input can't be undefined. " +
       "To initialize an archive without any data, give null to Twitter Archive constructor.");
    }

    if (file === null) {
      this.state = "ready";
      this.events.emit('ready');
    }
    else {
      this.state = "reading";
    
      this._ready = 
        (file instanceof Promise ? 
          file.then(f => (this.archive = constructArchive(f)).ready())
          : (this.archive = constructArchive(file)).ready()
        )
        .then(() => this.init(PARTS_TO_READ))
        .then(() => {
          this.events.emit('ready');
        })
        .catch(e => {
          this.events.emit('error', { type: 'error', detail: e });
          return Promise.reject(e);
        });
    }
  }

  protected addTweetsToGdprArchive(tweets: PartialTweetGDPR[]) {
    try {
      this._tweets.addGDPR(tweets);
    } catch (e) {
      if (e instanceof Error) {
        throw new TweetFileError(
          `Unable to compute tweets: ${e.message}`,
          tweets[0],
          e.stack
        );
      }

      throw e;
    }
  }

  protected init(parts_to_read: Set<ArchiveReadPart>) {
    // Detect archive type
    this._is_gdpr = this.archive.search(/^tweets\.csv$/).length === 0;
            
    // Listen for read error events on archives
    this.archive.events.on('read error', ({ filename }: { filename: string }) => {
      this.events.emit('archive file not found error', { filename });
    });

    // Init media archive
    this._medias = new MediaArchive(this.archive);

    this.events.emit('zipready');
    this.events.emit('read', { step: 'zipready' });

    // Init the archive data (read tweets and DMs)
    if (this.is_gdpr) {
      return this.initGDPR(parts_to_read);
    }
    else {
      return this.initClassic(parts_to_read);
    }
  }

  protected async initGDPR(parts_to_read: Set<ArchiveReadPart>) {
    // Returns element if element in parts_to_read, empty string otherwise
    function hasOrEmpty(element: ArchiveReadPart): ArchiveReadPart | "" {
      if (parts_to_read.has(element))
        return element;
      return "";
    }

    // ------------------------
    // TWEETS AND PROFILE INFOS
    // ------------------------

    // this._info is initialized here
    await this.loadArchivePart({
      account: await this.archive.get('account.js'),
      profile: await this.archive.get('profile.js'),
    });
    
    this.events.emit('userinfosready');
    this.events.emit('read', { step: 'userinfosready' });

    // Starts the tweet read
    this.state = "tweet_read";
    this.events.emit('tweetsread');
    this.events.emit('read', { step: 'tweetsread' });

    await this.initArchivePart(hasOrEmpty("tweet"));

    // Tweets are now indexed and parsed
    this.events.emit('indexready');
    this.events.emit('read', { step: 'indexready' });


    // ---------------
    // DIRECT MESSAGES
    // ---------------

    this.state = "dm_read";
    this.events.emit('willreaddm');
    this.events.emit('read', { step: 'willreaddm' });

    await this.initArchivePart(hasOrEmpty("dm"));
    
    // DMs should be ok

    this.state = "extended_read";
    this.events.emit('willreadextended');
    this.events.emit('read', { step: 'willreadextended' });

    // Init the extended GDPR data
    await this.initArchivePart(
      hasOrEmpty("follower"), 
      hasOrEmpty("following"), 
      hasOrEmpty("favorite"), 
      hasOrEmpty("mute"), 
      hasOrEmpty("block"),
      hasOrEmpty("list"),
      hasOrEmpty("moment")
    );

    // Init deep user info (this not really heavy, so we parse it anyway)
    await this._user.__init(this.archive);

    await this.initArchivePart("ad");

    this.state = "ready";
  }

  protected async initClassic(parts_to_read: Set<ArchiveReadPart>) {
    this.state = "user_read";
    const js_dir = this.archive.dir('data').dir('js');

    this.loadClassicArchivePart({
      payload: await js_dir.get('payload_details.js'), 
      user: await js_dir.get('user_details.js'),
    });

    this.events.emit('userinfosready');
    this.events.emit('read', { step: 'userinfosready' });

    await this.initArchivePart(
      parts_to_read.has("tweet") ? "tweet" : ""
    );    
  }

  /**
   * Read one or more archive parts from loaded archive.
   * 
   * You don't need to call this method if you use the default constructor.
   */
  async initArchivePart(...parts: (ArchiveReadPart | "")[]) {
    const p = new Set(parts);

    if (p.has("tweet")) {
      if (this.is_gdpr) {
        this.addTweetsToGdprArchive(await this.archive.get('tweet.js'));

        if (Settings.LOW_RAM) {
          // Sleep to temperate load; Helps garbage collector, with asynchonous tasks.
          await sleep(750);
        }

        let i = 1;
        while (this.archive.has(`tweet-part${i}.js`)) {
          // Add every tweet in other files 
          // inside a "new" array in the initial array
          this.addTweetsToGdprArchive(await this.archive.get(`tweet-part${i}.js`));
          i++;
        }
      }
      else {
        const js_dir = this.archive.dir('data').dir('js');
        const index: ClassicTweetIndex = await js_dir.get('tweet_index.js');
        const files_to_read = index.map(e => e.file_name);

        this.state = "tweet_read";

        const tweet_file_promises: Promise<PartialTweet[]>[] = [];

        // Read every tweet file
        for (const file of files_to_read) {
          tweet_file_promises.push(this.archive.get(file));
        }
        
        // Concat all tweet files
        let tweets: PartialTweet[] = [].concat(...await Promise.all(tweet_file_promises));

        // Sort the tweets
        tweets = sortTweets(tweets);

        this.events.emit('tweetsread');
        this.events.emit('read', { step: 'tweetsread' });

        this.state = "indexing";

        // Add tweets in TweetArchive
        this._tweets.add(tweets);

        this.events.emit('indexready');
        this.events.emit('read', { step: 'indexready' });
        this.state = "ready";
      }
    }

    if (!this.is_gdpr) {
      return;
    }

    if (p.has("dm")) {
       // Init DMs
      const conv_files = [
        'direct-message.js', 
        'direct-messages.js', 
        'direct-message-group.js',
        'direct-messages-group.js',
      ];

      let i = 1;
      while (this.archive.has(`direct-message-part${i}.js`)) {
        conv_files.push(`direct-message-part${i}.js`);
        i++;
      }
      i = 1;
      while (this.archive.has(`direct-messages-part${i}.js`)) {
        conv_files.push(`direct-messages-part${i}.js`);
        i++;
      }

      for (const file of conv_files.filter(name => this.archive.has(name))) {
        await this.loadArchivePart({
          dms: [await this.archive.get(file)]
        });

        if (Settings.LOW_RAM) {
          // Sleep to temperate load; Helps garbage collector, with asynchonous tasks.
          await sleep(750);
        }  
      }
    }
    if (p.has("following")) {
      // Followings
      const followings = new Set<string>();
          
      try {
        const f_following: GDPRFollowings = await this.archive.get('following.js');
        for (const f of f_following) {
          followings.add(f.following.accountId);
        }
      } catch (e) { }

      this.extended_info_container.followings = followings;
    }
    if (p.has("follower")) {
      // Followers
      const followers = new Set<string>();

      try {
        const f_follower: GDPRFollowers = await this.archive.get('follower.js');
        for (const f of f_follower) {
          followers.add(f.follower.accountId);
        }
      } catch (e) { }

      this.extended_info_container.followers = followers;
    }
    if (p.has("favorite")) {
      // Favorites
      try {
        const f_fav: GDPRFavorites = await this.archive.get('like.js');
        this._favorites.add(f_fav);
      } catch (e) { }
    }
    if (p.has("mute")) {
      // Mutes
      const mutes = new Set<string>();

      try {
        const f_mutes: GDPRMutes = await this.archive.get('mute.js');
        for (const f of f_mutes) {
          mutes.add(f.muting.accountId);
        }
      } catch (e) { }

      this.extended_info_container.mutes = mutes;
    }
    if (p.has("block")) {
      // Blocks
      const blocks = new Set<string>();
      
      try {
        const f_block: GDPRBlocks = await this.archive.get('block.js');
        for (const f of f_block) {
          blocks.add(f.blocking.accountId);
        }
      } catch (e) { }
      this.extended_info_container.blocks = blocks;
    }
    if (p.has("list")) {
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

      this.extended_info_container.lists = lists;
    }
    if (p.has("moment")) {
      // Moments
      let moments: GDPRMoment[] = [];
      try {
        moments = (await this.archive.get('moment.js') as GDPRMomentFile).map(e => e.moment);
      } catch (e) { }

      this.extended_info_container.moments = moments;
    }
    if (p.has("ad")) {
      await this._ads.__init(this.archive);
    }
  }


  /** ----------------- */
  /** ARCHIVE ACCESSORS */
  /** ----------------- */


  /* Pure properties */
  /* --------------- */

  /** 
   * `true` if ZIP file is still loaded inside this instance. 
   * Can be freed (to save memory, f.e.) with `.releaseZip()`. 
   */
  get is_zip_loaded() {
    return !!this.archive;
  }

  /** 
   * Archive creation date. 
   * 
   * **Warning**: This is accurate only for classic archives (< 2018, tweet only). 
   * 
   * In GDPR archives, this will be the current date. 
   * 
   */
  get generation_date() {
    return parseTwitterDate(this._created_at);
  }

  /** 
   * Archive quick information. 
   * 
   * - `.info.archive` : `{ created_at: string, tweets: number }`
   * - `.info.user`: See `TwitterUserDetails`
   */
  get info() : BasicArchiveInfo {
    return {
      archive: {
        created_at: this._created_at,
        tweets: this.tweets.length
      },
      user: this._user.summary
    };
  }

  /** `true` if archive is a GDPR archive. */
  get is_gdpr() {
    return this._is_gdpr;
  }

  /** 
   * Raw archive object. Can be used to get specific files.
   * 
   * Returns twitter_archive.
   */
  get raw() : ConstructibleArchives {
    return this.archive;
  }

  /** Resolved when archive read is over. */
  ready() {
    return this._ready;
  }


  /* Access to inner containers */
  /* -------------------------- */

  /** Access to the `DMArchive` object. Will be undefined if `.is_gdpr === false`. */
  get messages() {
    return this._messages;
  }

  /** Access to the `TweetArchive` object. Contains all the tweets of this archive. */
  get tweets() {
    return this._tweets;
  }

  /** 
   * Access to the `FavoriteArchive` object. Contains all the favorited tweets of the archive. 
   * 
   * If `.is_gdpr === false`, this container will be empty.
   */
  get favorites() {
    return this._favorites;
  }

  /** 
   * Access to a set of followers IDs.
   * 
   * If `.is_gdpr === false`, this container will be empty.
   */
  get followers() {
    return this.extended_info_container.followers;
  }

  /** 
   * Access to a set of followings user IDs.
   * 
   * If `.is_gdpr === false`, this container will be empty.
   */
  get followings() {
    return this.extended_info_container.followings;
  }

  /** 
   * Access to a set of blocked user IDs.
   * 
   * If `.is_gdpr === false`, this container will be empty.
   */
  get blocks() {
    return this.extended_info_container.blocks;
  }

  /** 
   * Access to a set of muted user IDs.
   * 
   * If `.is_gdpr === false`, this container will be empty.
   */
  get mutes() {
    return this.extended_info_container.mutes;
  }

  /** 
   * Access to archive Twitter moments.
   * 
   * If `.is_gdpr === false`, this array will be empty.
   */
  get moments() {
    return this.extended_info_container.moments;
  }

  /** 
   * Access to your subscribed and created lists, and the lists you were added into. 
   * 
   * If `.is_gdpr === false`, this container will be contain empty arrays.
   */
  get lists() {
    return this.extended_info_container.lists;
  }

  /** 
   * All the archive owner's user data on Twitter.
   * 
   * Contains data sended to Twitter about archive owner, like: 
   * - **Screen name (@)** 
   * - **Tweet name (TN)**
   * - **Account creation date**
   * - **Biography**
   * - **Phone number**
   * - **Personnalization** (inferred informations about user interests)
   * - **Email addresses**
   * - *...*
   * 
   * If `.is_gdpr === false`, this is will contain only basic data (related to `.user.summary`).
   */
  get user() {
    return this._user;
  }

  /** 
   * Informations about which ads archive owner seen or interacted with.
   */
  get ads() {
    return this._ads;
  } 

  /**
   * Access to medias stored in this archive, like dm images, tweet medias and profile pictures.
   */
  get medias() {
    return this._medias;
  }

  /** -------------------- */
  /** SIDELOADING MANUALLY */
  /** -------------------- */
  
  /**
   * Load a part of a GDPR archive.
   * 
   * Set current archive as GDPR archive.
   */
  async loadArchivePart(parts: {
    tweets?: PartialTweetGDPR[],
    account?: AccountGDPR,
    profile?: ProfileGDPR,
    dms?: DMFile[],
    favorites?: PartialFavorite[],
    blocks?: string[],
    mutes?: string[],
    followers?: string[],
    followings?: string[],
    moments?: GDPRMoment[],
  } = {}) {
    this._is_gdpr = true;

    if (parts.account) {
      // Init informations
      try {
        const account = parts.account[0].account;
  
        this._user.loadPart({
          summary: {
            ...this._user.summary,
            screen_name: account.username,
            full_name: account.accountDisplayName,
            id: account.accountId,
            created_at: account.createdAt,
          }
        });
      } catch (e) {
        if (e instanceof Error) {
          throw new AccountFileError(
            `Unable to use account file: ${e.message}`,
            parts.account,
            e.stack
          );
        }
        throw e;
      }

      // (re)init the tweet archive user cache
      this.initUserCache();
    }
    if (parts.profile) {
      try {
        const profile = parts.profile[0].profile;
        
        this._user.loadPart({
          summary: {
            ...this._user.summary,
            location: profile.description.location,
            bio: profile.description.bio,
            profile_image_url_https: profile.avatarMediaUrl,
            profile_banner_url: profile.headerMediaUrl,
            url: profile.description.website,
          }
        });
      } catch (e) {
        if (e instanceof Error) {
          throw new ProfileFileError(
            `Profile file is incorrect: ${e.message}`,
            parts.profile,
            e.stack
          );
        }
        throw e;
      }

      // (re)init the tweet archive user cache
      this.initUserCache();
    }
    if (parts.tweets) {
      try {
        this._tweets.addGDPR(parts.tweets);
      } catch (e) {
        if (e instanceof Error) {
          throw new TweetFileError(
            `Unable to compute tweets: ${e.message}`,
            parts.tweets[0],
            e.stack
          );
        }

        throw e;
      }
    }
    if (parts.dms) {
      if (!this._messages) {
        this._messages = new DMArchive(this.user.id);
      }
      
      for (const file of parts.dms) {
        try {
          this._messages.add(file);
        } catch (e) {
          if (e instanceof Error) {
            let reason = "";
            let extract: any;
            if (!Array.isArray(file)) {
              reason = "File is not an array.";
              extract = file;
            }
            else {
              if (file[0].dmConversation) {
                const conv = file[0].dmConversation;
                if (conv.messages) {
                  extract = conv.messages[0];
                  reason = "Missing property ?";
                }
                else {
                  extract = conv;
                  reason = "Unable to found messages.";
                }
              }
              else {
                reason = "Property DM conversation does not exists.";
                extract = file[0];
              }
            }

            throw new DirectMessageParseError(
              `Unable to parse direct messages: ${e.message} (${reason})`,
              extract,
              e.stack
            );
          }
          throw e;
        }
      }
    }
    if (parts.favorites) {
      if (!this._favorites) {
        this._favorites = new FavoriteArchive;
      }
      this._favorites.add(parts.favorites);
    }
    if (parts.blocks) {
      for (const block of parts.blocks) {
        this.extended_info_container.blocks.add(block);
      }
    }
    if (parts.mutes) {
      for (const mute of parts.mutes) {
        this.extended_info_container.mutes.add(mute);
      }
    }
    if (parts.followers) {
      for (const follower of parts.followers) {
        this.extended_info_container.followers.add(follower);
      }
    }
    if (parts.followings) {
      for (const following of parts.followings) {
        this.extended_info_container.followings.add(following);
      }
    }
    if (parts.moments) {
      this.extended_info_container.moments.push(...parts.moments);
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
      try {
        this._tweets.add(sortTweets(parts.tweets));
      } catch (e) {
        if (e instanceof Error) {
          throw new TweetFileError(
            `Unable to compute tweets: ${e.message}`,
            parts.tweets[0],
            e.stack
          );
        }

        throw e;
      }
    }
    if (parts.user) {
      this._user.loadPart({
        summary: { ...this._user.summary, ...parts.user }
      });
    }
    if (parts.payload) {
      this._created_at = parts.payload.created_at;
    }
  }

  protected initUserCache() {
    this._tweets.__initUserCache({
      id_str: this._user.id,
      screen_name: this._user.screen_name,
      name: this._user.name,
      profile_image_url_https: this._user.profile_img_url
    });
  }

  /** --------------------------------------- */
  /** ARCHIVE FINGERPRINTING AND INFORMATIONS */
  /** --------------------------------------- */

  /**
   * Unload ZIP file inside this instance.
   * Returns `true` if ZIP has been unloaded.
   * 
   * ZIP can still be loaded in `archive.medias`, you can use its own `.releaseZip()` method.
   */
  releaseZip() {
    this.archive = undefined;
    return true;
  }

  /**
   * Résumé of this archive.
   * 
   * Contains the 'archive index' (without the tweets),
   * if the archive is GDPR, last tweet date,
   * tweet count and dm count.
   */
  get synthetic_info() {
    const info = this.synthetic_info_without_hash;
    info.hash = this.hash;

    return info;
  }

  /**
   * `.synthetic_info`, but without hash. Used to... calculate hash.
   */
  protected get synthetic_info_without_hash() {
    const info: ArchiveSyntheticInfo = {
      info: { ...this.info },
      is_gdpr: this.is_gdpr,
      version: "1.0.0",
      last_tweet_date: "",
      hash: "",
      tweet_count: this.tweets.length,
      dm_count: this.messages ? this.messages.count : 0,
    };
    // Delete archive info (useless)
    delete info.info.archive;

    // Take the last available year
    const last_year = Object.keys(this._tweets.index).sort((a, b) => Number(b) - Number(a))[0];
    const last_month = last_year ? Object.keys(this._tweets.index[last_year]).sort((a, b) => Number(b) - Number(a))[0] : undefined;

    if (last_year && last_month) {
      const tweets = this._tweets.index[last_year][last_month];
  
      let last_date = 0;
      for (const tweet of Object.values(tweets)) {
        const cur_date = dateFromTweet(tweet).getTime();
        if (cur_date > last_date) {
          last_date = cur_date;
        }
      }
      info.last_tweet_date = new Date(last_date).toString();
    }
    else {
      info.last_tweet_date = new Date(0).toString();
    }

    return info;
  }

  /**
   * Create a pseudo-unique hash from a archive information (number of tweets, owner, last tweet date...),
   * in order to have a fingerprint of one archive.
   */
  static hash(from: ArchiveSyntheticInfo | TwitterArchive) {
    const info = from instanceof TwitterArchive ? from.synthetic_info_without_hash : from;

    return md5(JSON.stringify({
      screen_name: info.info.user.screen_name,
      bio: info.info.user.bio,
      name: info.info.user.full_name,
      profile_image_url_https: info.info.user.profile_image_url_https,
      created_at: info.info.user.created_at,
      tweets: info.tweet_count,
      dms: info.dm_count,
      last_tweet_date: info.last_tweet_date,
      id: info.info.user.id,
      location: info.info.user.location,
    }));
  }

  /**
   * Pseudo-unique hash from the archive information (number of tweets, owner, last tweet date...),
   * in order to have a fingerprint of this archive.
   */
  get hash() {
    return TwitterArchive.hash(this);
  }
}

