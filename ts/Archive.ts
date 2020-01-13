import { AcceptedZipSources, Archive, BaseArchive, constructArchive } from './StreamArchive';
import { BasicArchiveInfo, PartialTweetGDPR, PartialTweet, AccountGDPR, ProfileGDPR, ClassicTweetIndex, ClassicPayloadDetails, TwitterUserDetails, DMFile, GDPRFollowings, GDPRFollowers, GDPRFavorites, GDPRMutes, GDPRBlocks, GDPRMoment, GDPRMomentFile, DirectMessage, ArchiveSyntheticInfo, PartialFavorite, ExtendedInfoContainer, TwitterArchiveLoadOptions } from './TwitterTypes';
import DMArchive from './DMArchive';
import { EventTarget, defineEventAttribute } from 'event-target-shim';
import md5 from 'js-md5';
import TweetArchive from './TweetArchive';
import { FavoriteArchive } from './FavoriteArchive';
import CollectedUserData from './CollectedUserData';
import AdArchive from './AdArchive';


/**
 * Parse a raw Twitter date, like from a `dm.createdAt`.
 * 
 * For a tweet, please use `TweetArchive.dateFromTweet(tweet)` instead, it's optimized !
 * 
 * For a `LinkedDirectMessage`, use property `.createdAtDate` !
 */
export const parseTwitterDate = TweetArchive.parseTwitterDate;

export type ArchiveReadState = "idle" | "reading" | "indexing" | "tweet_read" | "user_read" | "dm_read" | "extended_read" | "ready";

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
 * creation date is available through `.info.user`.
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
 * Binary data of Direct Message images can be get through `.dmImagesOf(dm_id: string)` method.
 * 
 * User detailled data (screen name history, email address) is in `.collected` property.
 */
export class TwitterArchive extends EventTarget<TwitterArchiveEvents, TwitterArchiveOnEvents> {
  protected _ready: Promise<void> = Promise.resolve();
  protected archive: BaseArchive<any>;

  /** Current archive load state. */
  public state: ArchiveReadState = "idle";

  protected _info: BasicArchiveInfo = {
    user: {
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
    }
  };

  protected statuses = new TweetArchive;
  protected dms: DMArchive;
  protected favs = new FavoriteArchive;
  protected extended_info_container: ExtendedInfoContainer;
  protected deep_info: CollectedUserData;
  protected ad_archive = new AdArchive;

  protected dm_img_archive: BaseArchive<any>;
  protected dm_img_group_archive: BaseArchive<any>;

  protected _is_gdpr = false;
  protected load_images_in_zip: boolean;

  /**
   * Twitter Archive constructor.
   * 
   * If you use the constructor, don't forget to await the archive ready-ness with `.ready()` method !
   * 
   * @param options.keep_loaded If possible, free the memory after load if set to false.
   * @param options.load_images_in_zip 
   * In Twitter GDPR archives v2, tweet and dm images are in ZIP archives inside the ZIP.
   * If `true`, TwitterArchive will extract its content in RAM to allow the usage of images.
   * If `false`, DMs images will be unavailable.
   * If `undefined`, Twitter will extract in RAM in browser mode, and leave the ZIP untouched in Node.js.
   * 
   * If you want to save memory, set this parameter to `false`, 
   * and before using `.dmImage()` methods, check if you need to load DM images ZIP 
   * with `.requires_dm_image_load`.
   * 
   * Then, if you need to, load the DM image ZIP present in the archive using `.loadArchivePart({ current_dm_images: true })`. 
   * **Please note that `keep_loaded` should be set to `true` to use this method !**
   * 
   * @param options.build_ad_archive
   * `true` if ad
   */
  constructor(
    file: AcceptedZipSources | Promise<AcceptedZipSources> | null, 
    options: TwitterArchiveLoadOptions = { 
      keep_loaded: false,
      build_ad_archive: false,
    }
  ) {
    super();
    this.initEmptyExtendedContainer();

    if (options.load_images_in_zip !== undefined) {
      this.load_images_in_zip = options.load_images_in_zip;
    }

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
            return this.initGDPR(options.keep_loaded === true, options.build_ad_archive === true);
          }
          else {
            return this.initClassic().then(() => {
              if (!options.keep_loaded) {
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

  protected async initGDPR(keep_loaded: boolean, build_ad_archive: boolean) {
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

    // this._info is initialized here
    await this.loadArchivePart({
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

    await this.loadArchivePart({
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

    await this.initExtendedGDPR();

    if (build_ad_archive) {
      await this.ad_archive.init(this.archive);
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
    try {
      const f_fav: GDPRFavorites = await this.archive.get('like.js');
      this.favs.add(f_fav);
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

    // Moments
    const moments: GDPRMoment[] = (await this.archive.get('moment.js') as GDPRMomentFile).map(e => e.moment);

    this.extended_info_container = {
      moments,
      lists,
      followers,
      followings,
      mutes,
      blocks
    };

    // Init deep user info
    this.deep_info = new CollectedUserData;
    await this.deep_info.init(this.archive);
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
    tweets = TweetArchive.sortTweets(tweets);

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

  /** --------------- */
  /** DM IMAGES STUFF */
  /** --------------- */

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

  /** ------------------------------------ */
  /** TWEET RELATED STUFF THAT SHOULD MOVE */
  /** ------------------------------------ */

  /**
   * @deprecated Please use appropriate getters for those kind of infos instead.
   * 
   * **Warning**: `.screen_name_history`, `.personalization`, `.protected_history`, `.age_info` properties
   * are removed.
   * 
   * For screen name history, see `.collected.screen_name_history`.
   * For personalization data, see `.collected.personalization`.
   * For protected history, see `.collected.protected_history`.
   * For age info, see `.collected.age`.
   * 
   * ---
   * 
   * Replacements for other properties, except favorites, are directly exposed on `TwitterArchive` instance.
   * 
   * Favorites are available in a new object, `FavoriteArchive`, 
   * in the `.favorites` property of the current `TwitterArchive` instance.
   */
  get extended_gdpr() {
    return { 
      ...this.extended_info_container,
      favorites: this.favorites.registred,
    };
  }

  /** ----------------- */
  /** ARCHIVE ACCESSORS */
  /** ----------------- */


  /* Pure properties */
  /* --------------- */

  /**
   * `true` if you need to load a DM image ZIP in order to use `.dmImage()`.
   * 
   * If you need to, use the `.loadArchivePart()` method:
   * - Loading the current DM image ZIP (if you've the constructor to not do so)
   * ```ts
   * await archive.loadArchivePart({ current_dm_images: true });
   * ```
   * 
   * ---
   * 
   * - Loading a custom DM ZIP (from external file)
   * ```ts
   * await archive.loadArchivePart({ dm_image_file: '<filepath.zip>' });
   * ```
   */
  get requires_dm_image_load() {
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
   * ID of the user who created this archive. 
   * 
   * Shortcut of `.info.user.id`.
   */
  get owner() {
    return this._info.user.id;
  }

   /** 
   * Screen name (@) of the user who created this archive.
   * May be obsolete (user can change screen_name over time).
   * 
   * Shortcut of `.info.user.screen_name`.
   */
  get owner_screen_name() {
    return this._info.user.screen_name;
  }

  /** Archive creation date. Not accurate in GDPR archive (will be the current date). */
  get generation_date() {
    return TweetArchive.parseTwitterDate(this._info.archive.created_at);
  }

  /** 
   * Archive information. 
   * 
   * - `.info.archive` : `{ created_at: string, tweets: number }`
   * - `.info.user`: See `TwitterUserDetails`
   */
  get info() {
    return this._info;
  }

  /** True if archive is a GDPR archive. */
  get is_gdpr() {
    if (this._is_gdpr === undefined)
      return this.isGDPRArchive();
    return this._is_gdpr;
  }

  /** 
   * Access to the `AdArchive` object, that contains informations 
   * about archive owner's seen and interacted ads.
   * 
   * `AdArchive` container does not contain any data if you 
   * haven't used `{ build_ad_archive: true }` constructor parameter.
   */
  get ads() {
    return this.ad_archive;
  } 

  /** 
   * Raw archive object. Can be used to get specific files.
   * 
   * Returns `[twitter_archive, dm_image_archive, dm_group_image_archive]`.
   */
  get raw() : [BaseArchive<any>, BaseArchive<any> | undefined, BaseArchive<any> | undefined] {
    return [this.archive, this.dm_img_archive, this.dm_img_group_archive];
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


  /* Access to inner containers */
  /* -------------------------- */

  /** Access to the `DMArchive` object. Will be undefined if `.is_gdpr === false`. */
  get messages() {
    return this.dms;
  }

  /** Access to the `TweetArchive` object. Contains all the tweets of this archive. */
  get tweets() {
    return this.statuses;
  }

  /** 
   * Access to the `FavoriteArchive` object. Contains all the favorited tweets of the archive. 
   * 
   * If `.is_gdpr === false`, this container will be empty.
   */
  get favorites() {
    return this.favs;
  }

  /** 
   * Access to a set of followers IDs.
   * 
   * If `.is_gdpr === false`, this container will be empty.
   */
  get followers() {
    if (this.extended_info_container)
      return this.extended_info_container.followers;
    return new Set<string>();
  }

  /** 
   * Access to a set of followings user IDs.
   * 
   * If `.is_gdpr === false`, this container will be empty.
   */
  get followings() {
    if (this.extended_info_container)
      return this.extended_info_container.followings;
    return new Set<string>();
  }

  /** 
   * Access to a set of blocked user IDs.
   * 
   * If `.is_gdpr === false`, this container will be empty.
   */
  get blocks() {
    if (this.extended_info_container)
      return this.extended_info_container.blocks;
    return new Set<string>();
  }

  /** 
   * Access to a set of muted user IDs.
   * 
   * If `.is_gdpr === false`, this container will be empty.
   */
  get mutes() {
    if (this.extended_info_container)
      return this.extended_info_container.mutes;
    return new Set<string>();
  }

  /** 
   * Access to archive Twitter moments.
   * 
   * If `.is_gdpr === false`, this array will be empty.
   */
  get moments() {
    if (this.extended_info_container)
      return this.extended_info_container.moments;
    return [];
  }

  /** 
   * Access to your subscribed and created lists, and the lists you were added into. 
   * 
   * If `.is_gdpr === false`, this container will be contain empty arrays.
   */
  get lists() {
    if (this.extended_info_container)
      return this.extended_info_container.lists;
    return {
      created: [],
      subscribed: [],
      member_of: []
    };
  }

  /** 
   * Access to the `CollectedUserData` instance.
   * 
   * Contains data collected by Twitter about archive owner: age information, 
   * phone number, personnalization infos, IP addresses, email addresses, ...
   * 
   * If `.is_gdpr === false`, this is `undefined`.
   */
  get collected() {
    return this.deep_info;
  }

  /** -------------------- */
  /** SIDELOADING MANUALLY */
  /** -------------------- */
  
  /**
   * Load a part of a GDPR archive.
   * 
   * Set current archive as GDPR archive.
   * 
   * ---
   * 
   * **Warning**: The DMs image parameters causes the read of a new archive.
   * Archive read is asynchronous, you **must** wait read end before trying to get images.
   */
  async loadArchivePart(parts: {
    tweets?: PartialTweetGDPR[],
    account?: AccountGDPR,
    profile?: ProfileGDPR,
    dms?: DMFile[],
    dm_image_file?: AcceptedZipSources | Promise<AcceptedZipSources>,
    dm_image_group_file?: AcceptedZipSources | Promise<AcceptedZipSources>,
    current_dm_images?: boolean,
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
      const account = parts.account[0].account;
      
      this._info.user.screen_name = account.username;
      this._info.user.full_name = account.accountDisplayName;
      this._info.user.id = account.accountId;
      this._info.user.created_at = account.createdAt;

      // (re)init the tweet archive user cache
      this.statuses.__initUserCache({
        id_str: this._info.user.id,
        screen_name: this._info.user.screen_name,
        name: this._info.user.full_name,
        profile_image_url_https: this._info.user.profile_image_url_https
      });
    }
    if (parts.profile) {
      const profile = parts.profile[0].profile;

      this._info.user.location = profile.description.location;
      this._info.user.bio = profile.description.bio;
      this._info.user.profile_image_url_https = profile.avatarMediaUrl;

      // (re)init the tweet archive user cache
      this.statuses.__initUserCache({
        id_str: this._info.user.id,
        screen_name: this._info.user.screen_name,
        name: this._info.user.full_name,
        profile_image_url_https: this._info.user.profile_image_url_https
      });
    }
    if (parts.tweets) {
      this.readGDPRTweets(parts.tweets);
    }
    if (parts.dms) {
      if (!this.dms) {
        this.dms = new DMArchive(this.owner);
      }
      
      for (const file of parts.dms) {
        this.dms.add(file);
      }
    }
    if (parts.dm_image_file) {
      await this.importDmImageZip(parts.dm_image_file);
    }
    if (parts.dm_image_group_file) {
      await this.importDmGroupImageZip(parts.dm_image_group_file);
    }
    if (parts.current_dm_images) {
      await this.loadCurrentDmImageZip();
    }
    if (parts.favorites) {
      if (!this.favs) {
        this.favs = new FavoriteArchive;
      }
      this.favs.add(parts.favorites);
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
      this.readTweets(TweetArchive.sortTweets(parts.tweets));
    }
    if (parts.user) {
      this._info.user = parts.user;
    }
    if (parts.payload) {
      this._info.archive = parts.payload;
    }
  }

  /**
   * Convert GDPR tweets into classic tweets, then register them into the index.
   */
  protected readGDPRTweets(tweets: PartialTweetGDPR[]) {
    this.statuses.addGDPR(tweets);

    // Set right tweet number
    this._info.archive.tweets = this.statuses.length;
  }

  /**
   * Register tweets into the index.
   */
  protected readTweets(tweets: PartialTweet[]) {
    this.statuses.add(tweets);

    // Set right tweet number
    this._info.archive.tweets = this.statuses.length;
  }

   /**
   * Import a custom ZIP file as DM single-conversation images file.
   */
  protected async importDmImageZip(file: AcceptedZipSources | Promise<AcceptedZipSources>) {
    this.dm_img_archive = constructArchive(await file);
    await this.dm_img_archive.ready();
  }

  /**
   * Import a custom ZIP file as DM group-conversation images file.
   */
  protected async importDmGroupImageZip(file: AcceptedZipSources | Promise<AcceptedZipSources>) {
    this.dm_img_group_archive = constructArchive(await file);
    await this.dm_img_group_archive.ready();
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
  protected async loadCurrentDmImageZip() {
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

  protected initEmptyExtendedContainer() {
    this.extended_info_container = {
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

  /** --------------------------------------- */
  /** ARCHIVE FINGERPRINTING AND INFORMATIONS */
  /** --------------------------------------- */

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
      info: { ...this._info },
      is_gdpr: this.is_gdpr,
      version: "1.0.0",
      last_tweet_date: "",
      hash: "",
      tweet_count: this.tweets.length,
      dm_count: this.messages ? this.messages.count : 0,
    };

    // Take the last available year
    const last_year = Object.keys(this.statuses.index).sort((a, b) => Number(b) - Number(a))[0];
    const last_month = last_year ? Object.keys(this.statuses.index[last_year]).sort((a, b) => Number(b) - Number(a))[0] : undefined;

    if (last_year && last_month) {
      const tweets = this.statuses.index[last_year][last_month];
  
      let last_date = 0;
      for (const tweet of Object.values(tweets)) {
        const cur_date = TweetArchive.dateFromTweet(tweet).getTime();
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

// Define onevents
defineEventAttribute(TwitterArchive.prototype, "zipready");
defineEventAttribute(TwitterArchive.prototype, "userinfosready");
defineEventAttribute(TwitterArchive.prototype, "tweetsread");
defineEventAttribute(TwitterArchive.prototype, "indexready");
defineEventAttribute(TwitterArchive.prototype, "willreaddm");
defineEventAttribute(TwitterArchive.prototype, "willreadextended");
defineEventAttribute(TwitterArchive.prototype, "ready");
defineEventAttribute(TwitterArchive.prototype, "error");
