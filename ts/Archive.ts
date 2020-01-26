import { AcceptedZipSources, Archive, BaseArchive, constructArchive } from './StreamArchive';
import { BasicArchiveInfo, PartialTweetGDPR, PartialTweet, AccountGDPR, ProfileGDPR, ClassicTweetIndex, ClassicPayloadDetails, TwitterUserDetails, DMFile, GDPRFollowings, GDPRFollowers, GDPRFavorites, GDPRMutes, GDPRBlocks, GDPRMoment, GDPRMomentFile, DirectMessage, ArchiveSyntheticInfo, PartialFavorite, ExtendedInfoContainer, TwitterArchiveLoadOptions } from './TwitterTypes';
import DMArchive from './DMArchive';
import { EventEmitter } from 'events';
import md5 from 'js-md5';
import TweetArchive from './TweetArchive';
import { FavoriteArchive } from './FavoriteArchive';
import UserData from './UserData';
import AdArchive from './AdArchive';


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
export type ArchiveDMImagesFormation = "none" | "inside" | "zipped";


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
 * Binary data of Direct Message images can be get through `.dmImagesOf(dm_id: string)` method.
 * 
 * User detailled data (screen name history, email address) is in `.user` property.
 */
export class TwitterArchive {
  protected _ready: Promise<void> = Promise.resolve();
  protected archive: BaseArchive<any>;

  /** Current archive load state. */
  public state: ArchiveReadState = "idle";
  /** Where events about archive read are emitted. */
  public readonly events = new EventEmitter;

  protected statuses = new TweetArchive;
  protected dms: DMArchive;
  protected favs = new FavoriteArchive;
  protected extended_info_container: ExtendedInfoContainer;
  protected _user = new UserData;
  protected ad_archive = new AdArchive;

  protected dm_img_archive: BaseArchive<any>;
  protected dm_img_group_archive: BaseArchive<any>;

  protected _is_gdpr: boolean;
  protected load_images_in_zip: boolean;
  protected _dm_images_type: ArchiveDMImagesFormation = "none";

  protected _created_at = new Date().toISOString();

  /**
   * Twitter Archive constructor.
   * 
   * Don't forget to await the archive ready-ness with `.ready()` method !
   * 
   * @param file Archive to load.
   * 
   * If you want to build an archive instance **without** a file, you can pass `null` here.
   * You must then load parts of the archive with `.loadArchivePart()` or `.loadClassicArchivePart()` !
   *
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
   * 
   * @param options.build_ad_archive
   * `true` if ad data should be parsed and loaded.
   * 
   * If you want to save time and memory at construct time, omit this parameter, it's set to `false` by default. 
   * 
   * Then, before first accessing `.ads`, load the archive data present in the archive 
   * using `.loadArchivePart({ current_ad_archive: true })`. 
   */
  constructor(
    file: AcceptedZipSources | Promise<AcceptedZipSources> | null, 
    options: TwitterArchiveLoadOptions = { 
      build_ad_archive: false,
    }
  ) {
    this.extended_info_container = getExtendedContainerBase();

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
          // Detect DM types
          this._dm_images_type = TwitterArchive.autoDetectDmStoreType(this.archive);
          // Detect archive type
          this._is_gdpr = this.archive.search(/^tweets\.csv$/).length === 0;

          this.events.emit('zipready');
  
          // Initialisation de l'archive Twitter
          if (this.is_gdpr) {
            return this.initGDPR(options.build_ad_archive === true);
          }
          else {
            return this.initClassic();
          }
        })
        .then(() => {
          this.events.emit('ready');
        })
        .catch(e => {
          this.events.emit('error', { type: 'error', detail: e });
          return Promise.reject(e);
        });
    }
  }

  protected async initGDPR(build_ad_archive: boolean) {
    try {
      // Delete the tweet media folder (big & useless)
      if (this.archive instanceof Archive) {
        this.archive.raw.remove('tweet_media');
      }
    } catch (e) { }

    // This is not accurate, but this is for compatibility reasons
    this.events.emit('userinfosready');
  
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

    this.events.emit('tweetsread');

    // this._info is initialized here
    await this.loadArchivePart({
      account: await this.archive.get('account.js'),
      profile: await this.archive.get('profile.js'),
      tweets
    });

    this.events.emit('indexready');


    // ---------------
    // DIRECT MESSAGES
    // ---------------

    this.state = "dm_read";
    this.events.emit('willreaddm');
    
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
    const should_autoload_zip_img = () => {
      if (typeof this.load_images_in_zip !== 'undefined') {
        return this.load_images_in_zip;
      }
  
      // test if node
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        // IsNode
        return false;
      }
      return true;
    };

    if (this._dm_images_type === "zipped") {
      if (this.archive.searchDir(/direct_message_media/).length) {
        const folder = this.archive.dir('direct_message_media');
        const query = folder.search(/\.zip$/);
        if (query.length) {
          // console.log("Creating archive from archive (single)");
          if (should_autoload_zip_img()) {
            this.dm_img_archive = await folder.fromFile(query[0]);
          }
        }
      }
      if (this.archive.searchDir(/direct_message_group_media/).length) {
        const folder = this.archive.dir('direct_message_group_media');
        const query = folder.search(/\.zip$/);
        if (query.length) {
          if (should_autoload_zip_img()) {
            // console.log("Creating archive from archive (group)");
            this.dm_img_group_archive = await folder.fromFile(query[0]);
          }
        }
      }
    }

    this.state = "extended_read";
    this.events.emit('willreadextended');

    await this.initExtendedGDPR();

    if (build_ad_archive) {
      await this.ad_archive.__init(this.archive);
    }

    this.state = "ready";
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
    await this._user.__init(this.archive);
  }

  protected async initClassic() {
    this.state = "user_read";
    const js_dir = this.archive.dir('data').dir('js');

    const index: ClassicTweetIndex = await js_dir.get('tweet_index.js');

    this.loadClassicArchivePart({
      payload: await js_dir.get('payload_details.js'), 
      user: await js_dir.get('user_details.js'),
    });

    this.events.emit('userinfosready');

    const files_to_read = index.map(e => e.file_name);

    this.state = "tweet_read";
    const tweet_file_promises: Promise<PartialTweet[]>[] = [];

    for (const file of files_to_read) {
      tweet_file_promises.push(this.archive.get(file));
    }
    
    let tweets: PartialTweet[] = [].concat(...await Promise.all(tweet_file_promises));

    // Tri les tweets par ID (le plus récent, plus grand en premier)
    tweets = TweetArchive.sortTweets(tweets);

    this.events.emit('tweetsread');

    this.state = "indexing";
    // Build index (read tweets)
    this.statuses.add(tweets);

    this.events.emit('indexready');
    this.state = "ready";
  }

  /** --------------- */
  /** DM IMAGES STUFF */
  /** --------------- */

  /** 
   * Give the media url in direct message, obtain the Blob-bed image. 
   * For use in Node.js, you must set `as_array_buffer` to `true` ! 
   */
  dmImageFromUrl(url: string, is_group: boolean = false, as_array_buffer = false) {
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
  dmImage(name: string, is_group: boolean = false, as_array_buffer = false) : Promise<Blob | ArrayBuffer> {
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

    const conv = this.messages.conversationOf(direct_message);
    if (!conv) {
      // msg not found
      return [];
    }

    if (typeof direct_message === 'string') 
      direct_message = conv.single(direct_message);

    const images: Promise<Blob | ArrayBuffer>[] = [];
    for (const media of direct_message.mediaUrls) {
      images.push(this.dmImageFromUrl(media, conv.is_group_conversation, as_array_buffer));
    }

    return Promise.all(images);
  }


  /** ----------------- */
  /** ARCHIVE ACCESSORS */
  /** ----------------- */


  /* Pure properties */
  /* --------------- */

  /** `true` if ZIP file is still loaded inside this instance. 
   * Can be freed (to save memory, f.e.) with `.releaseZip()`. */
  get is_zip_loaded() {
    return !!this.archive;
  }

  /** 
   * `true` if `.dmImage()` functions are accessible.
   * 
   * `false` if you need to load a DM image ZIP in order to use `.dmImage()`.
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
  get is_dm_images_available() {
    if (!this._is_gdpr) {
      return false;
    }
    if (this.dm_img_archive || this.dm_img_group_archive) {
      // If one of them is loaded, it's OK.
      return true;
    }
    if (this.is_zip_loaded) {
      if (this._dm_images_type === "zipped") {
        return false;
      }
      // type === "inside"
      return true;
    }
    // archive not loaded and any dm image archive
    return false;
  }

  /** Archive creation date. Not accurate in GDPR archive (will be the current date). */
  get generation_date() {
    return TweetArchive.parseTwitterDate(this._created_at);
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
   * Returns `[twitter_archive, dm_image_archive, dm_group_image_archive]`.
   */
  get raw() : [BaseArchive<any>, BaseArchive<any> | undefined, BaseArchive<any> | undefined] {
    return [this.archive, this.dm_img_archive, this.dm_img_group_archive];
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
   * 
   * `AdArchive` container does not contain any data if you 
   * haven't used `{ build_ad_archive: true }` constructor parameter.
   */
  get ads() {
    return this.ad_archive;
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
   * **Warning**: The DMs image parameters / current_ad_archive causes the read of new data.
   * Read is asynchronous, you **must** wait read end before trying to get images / ad data.
   * 
   * ---
   * 
   * If you use the `current_*` parameters, ensure that archive is still loaded (`.is_zip_loaded`).
   */
  async loadArchivePart(parts: {
    tweets?: PartialTweetGDPR[],
    account?: AccountGDPR,
    profile?: ProfileGDPR,
    dms?: DMFile[],
    dm_image_file?: AcceptedZipSources | Promise<AcceptedZipSources>,
    dm_image_group_file?: AcceptedZipSources | Promise<AcceptedZipSources>,
    current_dm_images?: boolean,
    current_ad_archive?: boolean,
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

      this._user.loadPart({
        summary: {
          ...this._user.summary,
          screen_name: account.username,
          full_name: account.accountDisplayName,
          id: account.accountId,
          created_at: account.createdAt
        }
      });

      // (re)init the tweet archive user cache
      this.initUserCache();
    }
    if (parts.profile) {
      const profile = parts.profile[0].profile;

      this._user.loadPart({
        summary: {
          ...this._user.summary,
          location: profile.description.location,
          bio: profile.description.bio,
          profile_image_url_https: profile.avatarMediaUrl
        }
      });

      // (re)init the tweet archive user cache
      this.initUserCache();
    }
    if (parts.tweets) {
      this.statuses.addGDPR(parts.tweets);
    }
    if (parts.dms) {
      if (!this.dms) {
        this.dms = new DMArchive(this.user.id);
      }
      
      for (const file of parts.dms) {
        this.dms.add(file);
      }
    }
    if (parts.dm_image_file) {
      await this.importDmImageZip(parts.dm_image_file);
    }
    if (parts.dm_image_group_file) {
      await this.importDmImageZip(parts.dm_image_group_file, true);
    }
    if (parts.current_dm_images) {
      await this.loadCurrentDmImageZip();
    }
    if (parts.current_ad_archive && this.is_zip_loaded) {
      await this.ad_archive.__init(this.archive);
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
      this.statuses.add(TweetArchive.sortTweets(parts.tweets));
    }
    if (parts.user) {
      this._user.loadPart({
        summary: parts.user
      });
    }
    if (parts.payload) {
      this._created_at = parts.payload.created_at;
    }
  }

  /**
   * Import a custom ZIP file as DM single-conversation images file.
   */
  protected async importDmImageZip(file: AcceptedZipSources | Promise<AcceptedZipSources>, group = false) {
    if (group) {
      this.dm_img_group_archive = constructArchive(await file);
      await this.dm_img_group_archive.ready();
    }
    else {
      this.dm_img_archive = constructArchive(await file);
      await this.dm_img_archive.ready();
    }
    this._dm_images_type = "zipped";
  }

  /**
   * Load/reload zip archives that contains DM images, 
   * if `load_images_in_zip` parameter was set to false.
   * 
   * You need to have the archive loaded to accomplish this action.
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

  protected initUserCache() {
    this.statuses.__initUserCache({
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
   * 
   * Please note that if the ZIP files are still required for operations,
   * this method will do nothing if parameter `force` is `false`.
   * 
   * **Warning: Before calling this method, check if `.is_dm_images_available` is `true` !**
   * If not, if you want DM images to be available, please do it with `.loadArchivePart({ current_dm_images: true })`.
   * 
   * ```ts
   * if (!archive.is_dm_images_available) {
   *  await archive.loadArchivePart({ current_dm_images: true });
   * }
   * archive.releaseZip();
   * ```
   * 
   * Returns `true` if ZIP has been unloaded.
   */
  releaseZip(force = false) {
    if (!this.is_zip_loaded) {
      return true;
    }

    if (!force && this._dm_images_type === "inside") {
      return false;
    }

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

  protected static autoDetectDmStoreType(archive: BaseArchive<any>) : ArchiveDMImagesFormation {
    if (archive.searchDir(/direct_message_media/).length) {
      const folder = archive.dir('direct_message_media');
      const query = folder.search(/\.zip$/);
      if (query.length) {
        return "zipped";
      }
      return "inside";
    }
    if (archive.searchDir(/direct_message_group_media/).length) {
      const folder = archive.dir('direct_message_group_media');
      const query = folder.search(/\.zip$/);
      if (query.length) {
        return "zipped";
      }
      return "inside";
    }

    return "none";
  }

  /*
   * Events defined (compatibility)
   */
  /** 
   * @deprecated
   * For compatibility only. Use `.events.on()` instead. 
   */
  addEventListener(event: string, listener: (...args: any[]) => void) {
    this.events.on(event, listener);
  }

  /** 
   * @deprecated
   * For compatibility only. Use `.events.off()` instead. 
   */
  removeEventListener(event: string, listener: (...args: any[]) => void) {
    this.events.off(event, listener);
  }
}

