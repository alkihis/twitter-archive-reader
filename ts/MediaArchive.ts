import { AcceptedZipSources, constructArchive, ConstructibleArchives } from "./reading/StreamArchive";
import UserData from "./user/UserData";
import { DirectMessage } from "./types/GDPRDMs";
import { PartialTweet, PartialTweetMediaEntity } from "./types/ClassicTweets";
import { MediaGDPREntity } from "./types/GDPRTweets";
import { FileNotFoundError } from "./utils/Errors";

export type ArchiveDMImagesFormation = "none" | "inside" | "zipped";
type ExisitingArchives = "dm_single" | "dm_group" | "tweet" | "moment" | "profile";

export enum MediaArchiveType {
  SingleDM = "single-dm", 
  GroupDM = "group-dm", 
  Moment = "moment", 
  Tweet = "tweet", 
  Profile = "profile",
}

export class MediaArchive {
  /**
   * Contains associations with internal `typeName` to `SingleMediaArchive` instances.
   */
  protected folders_to_archive: { [typeName: string]: SingleMediaArchive } = {};
  /**
   * User defined media types, associated to folders.
   */
  protected custom_folders: { [typeName: string]: string[] } = {};

  protected static readonly DM_SINGLE_FOLDER = ["direct_message_media", "direct_messages_media"];
  protected static readonly DM_GROUP_FOLDER = ["direct_message_group_media", "direct_messages_group_media"];
  protected static readonly TWEET_FOLDER = "tweet_media";
  protected static readonly PROFILE_FOLDER = "profile_media";
  protected static readonly MOMENT_FOLDER = "moments_media";

  protected _store_type: ArchiveDMImagesFormation = "none";

  constructor(protected archive: ConstructibleArchives) { 
    if (this.archive)
      this._store_type = MediaArchive.autoDetectStoreType(this.archive);
  }

  /*
   * MEDIA GETTERS: PUBLIC
   */
  
  /**
  * Get a media from a specific media type.
  * 
  * @param from Media archive type
  * @param name Filename (exact filename required)
  * @param as_array_buffer True if return type is ArrayBuffer. Otherwise, Blob will be used.
  * By default, returns ArrayBuffer on Node.js and Blob when available.
  * 
  * ```ts
  * // For parameter {from}, you can use `MediaArchiveType` enum.
  * import { MediaArchiveType } from 'twitter-archive-reader';
  * 
  * const my_media = archive.medias.get(MediaArchiveType.SingleDM, "xxx.jpg", true) as Promise<ArrayBuffer>;
  * ```
  */
  async get(from: MediaArchiveType | string, name: string, as_array_buffer?: boolean) : Promise<Blob | ArrayBuffer> {
    if (!(from in this.folders_to_archive) && this.getFolderOfType(from) === undefined) {
      throw new Error("You need to define your custom archive type before using it.");
    }

    return (
      await this.initOrAwaitArchive(this.getArchiveType(from), this.getFolderOfType(from))
    ).file(name, as_array_buffer);
  }

  /**
  * List files available on a specific media archive.
  * 
  * @param of_archive Media archive
  */
  async list(of_archive: MediaArchiveType | string) {
    if (!(of_archive in this.folders_to_archive) && this.getFolderOfType(of_archive) === undefined) {
      throw new Error("You need to define your custom archive type before using it.");
    }

    return (
      await this.initOrAwaitArchive(this.getArchiveType(of_archive), this.getFolderOfType(of_archive))
    ).files;
  }

  /*
   * MEDIA GETTERS: PRIVATE
   */

  protected getArchiveType(archive: string) {
    switch (archive) {
      case MediaArchiveType.SingleDM: return "dm_single";
      case MediaArchiveType.GroupDM: return "dm_group";
      case MediaArchiveType.Tweet: return "tweet";
      case MediaArchiveType.Moment: return "moment";
      case MediaArchiveType.Profile: return "profile";
    }
    return archive;
  }

  protected getFolderOfType(archive: string) {
    switch (archive) {
      case MediaArchiveType.SingleDM: return MediaArchive.DM_SINGLE_FOLDER;
      case MediaArchiveType.GroupDM: return MediaArchive.DM_GROUP_FOLDER;
      case MediaArchiveType.Tweet: return MediaArchive.TWEET_FOLDER;
      case MediaArchiveType.Moment: return MediaArchive.MOMENT_FOLDER;
      case MediaArchiveType.Profile: return MediaArchive.PROFILE_FOLDER;
    }

    if (archive in this.custom_folders) {
      return this.custom_folders[archive];
    }
  }

  // -------------------
  // - Direct Messages -
  // -------------------

  /**
   * Return all the images of a direct message, as blob or array buffer.
   * 
   * If the message does not exists or the DM archive is not loaded / available,
   * return an empty array.
   * 
   * Otherwise, return a array of `Blob` / `ArrayBuffer`
   * 
   * @param direct_message Direct message object
   * @param as_array_buffer Return an `ArrayBuffer` array, instead of a `Blob` array
   */
  async ofDm(direct_message: DirectMessage, as_array_buffer?: boolean): Promise<(Blob | ArrayBuffer)[]> {
    const images: Promise<Blob | ArrayBuffer>[] = [];

    const is_group = !direct_message.recipientId || direct_message.recipientId === "0";

    for (const media of direct_message.mediaUrls) {
      images.push(this.fromDmMediaUrl(media, is_group, as_array_buffer));
    }

    return Promise.all(images);
  }

  /** 
   * Extract the related media file to a URL present in the `mediaUrls` array of a Direct Message.
   */
  fromDmMediaUrl(url: string, is_group: boolean = false, as_array_buffer?: boolean) : Promise<Blob | ArrayBuffer> {
    const [, , , , id, , image] = url.split('/');

    if (id && image) {
      if (is_group)
        return this.get(MediaArchiveType.GroupDM, id + "-" + image, as_array_buffer);
      else
        return this.get(MediaArchiveType.SingleDM, id + "-" + image, as_array_buffer);
    }
    return Promise.reject("URL is invalid");
  }


  // ----------
  // - Tweets -
  // ----------

  /**
   * Get all the medias related to a tweet.
   */
  async ofTweet(tweet: PartialTweet, as_array_buffer?: boolean) : Promise<(Blob | ArrayBuffer)[]> {
    const entities = tweet.extended_entities;

    if (!entities || !entities.media) {
      return [];
    }

    const medias: Promise<(ArrayBuffer | Blob)>[] = [];
    for (const media of entities.media) {
      medias.push(this.fromTweetMediaEntity(media, as_array_buffer));
    }

    return Promise.all(medias);
  }

  /**
   * Extract related tweet video or picture from a media entity.
   * 
   * ```ts
   * const tweet = archive.tweets.all[0];
   * 
   * if (tweet.extended_entities || tweet.entities) {
   *    // Always try to use extended entities instead of classic entities
   *    const m_entities = (tweet.extended_entities || tweet.entities).media;
   * 
   *    if (m_entities && m_entities.length) {
   *      const media_file = archive.medias.fromTweetMediaEntity(m_entities[0]);
   *    }
   * }
   * ```
   * 
   * @throws If not valid media found, promise is rejected.
   */
  async fromTweetMediaEntity(media_entity: MediaGDPREntity | PartialTweetMediaEntity, as_array_buffer?: boolean) : Promise<Blob | ArrayBuffer> {
    if ('video_info' in media_entity) {
      // This is a gif or a video
      // Find the best variant
      const mp4s = media_entity.video_info.variants.filter(v => v.content_type === "video/mp4").filter(v => v.bitrate);

      if (mp4s) {
        const better = mp4s.sort((a, b) => Number(b.bitrate) - Number(a.bitrate))[0];

        const url = better.url.split('/').pop();
        const url_without_qs = url.split('?')[0];
        if (url_without_qs) {
          return this.get(MediaArchiveType.Tweet, url_without_qs, as_array_buffer);
        }
      }
    }
  
    const url = media_entity.media_url_https.split('/').pop();
    const url_without_qs = url.split('?')[0];
    if (url_without_qs) {
      return this.get(MediaArchiveType.Tweet, url_without_qs, as_array_buffer);
    }
    throw new Error("No valid file in this media entity.");
  }


  // -----------
  // - Profile -
  // -----------

  /**
   * Get the profile banner of given user.
   * 
   * The first parameter should generally be `archive.user`.
   * 
   * If user has no banner, this method returns `Promise<void>`.
   */
  async getProfileBannerOf(user: UserData, as_array_buffer?: boolean) : Promise<Blob | ArrayBuffer> {
    if (user.profile_banner_url) {
      const img_name = user.profile_banner_url.split('/').pop();
      if (img_name) {
        return this.get(MediaArchiveType.Profile, img_name, as_array_buffer);
      }
    }
  }

  /**
   * Get the profile picture of given user.
   * 
   * The first parameter should generally be `archive.user`.
   * 
   * If user has no profile picture, this method returns `Promise<void>`.
   */
  async getProfilePictureOf(user: UserData, as_array_buffer?: boolean) : Promise<Blob | ArrayBuffer> {
    if (user.profile_img_url) {
      const img_name = user.profile_img_url.split('/').pop();
      if (img_name) {
        return this.get(MediaArchiveType.Profile, img_name, as_array_buffer);
      }
    }
  }


  // -----------
  // - Moments -
  // -----------

  /** 
   * Extract a moment header image from GDPR archive (exact filename required). 
   * 
   * In order to have tweets medias inside the moments (duplicated by Twitter in the archive, use `.ofTweet(tweet)`).
   * 
   * Shortcut of `.get(MediaArchiveType.Moment, name, as_array_buffer)`, prefer using this instead.
   * 
   * @param name Media filename 
   */
  async fromMomentDirectory(name: string, as_array_buffer?: boolean) : Promise<Blob | ArrayBuffer> {
    return this.get(MediaArchiveType.Moment, name, as_array_buffer);
  }


  /*
   * ACCESSORS
   */

  get is_medias_zipped() {
    return this._store_type === "zipped";
  }

  get has_medias() {
    return this._store_type !== "none";
  }

  get is_zip_loaded() {
    return !!this.archive;
  }

  releaseZip() {
    this.archive = undefined;
  }


  /*
   * INIT ARCHIVES
   */

  /**
   * Manually set the archive used for a media type.
   * 
   * The specified {mediaType} can be a reference to a `MediaArchiveType` enum, or a custom media type
   * registered with `.registerMediaFolder()` method.
   * 
   * ```ts
   * import { MediaArchiveType } from 'twitter-archive-reader';
   * 
   * // Accepted types are the same as accepted for `TwitterArchive` constructor
   * const my_tweet_media_archive = "tweet_media.zip";
   * 
   * // Load this archive instead of base one
   * await archive.medias.loadArchive({
   *   [MediaArchiveType.Tweet]: my_tweet_media_archive
   * });
   * ```
   */
  async loadArchive(parts: { [mediaType: string]: AcceptedZipSources | Promise<AcceptedZipSources> }) {
    for (const part in parts) {
      // Check if the media folder exists
      const folder = this.getFolderOfType(part);

      if (folder === undefined) {
        throw new Error("You need to define your custom archive type before using it.");
      }

      // Init the archive
      this.folders_to_archive[part] = new SingleMediaArchive(null, "");
      await this.folders_to_archive[part].sideload(constructArchive(await parts[part]));
    }
  }

  protected async initOrAwaitArchive(archive_type: ExisitingArchives | string, init_folder: string | string[]) {
    if (!this.folders_to_archive[archive_type]) {
      this.folders_to_archive[archive_type] = new SingleMediaArchive(this.archive, init_folder);
    }
    await this.folders_to_archive[archive_type].ready;
    return this.folders_to_archive[archive_type];
  }

  /**
   * If the archive has a custom media folder, you can specify it here.
   * 
   * @param type_name Refers to used name to access this folder, take care of not using one of the `MediaArchiveType` enum.
   * When you use `.get()` and `.list()`, use this {type_name} as first parameter of those methods.
   * 
   * @param folder Folder name in the archive.
   * @param alternative_names Alternate folder names if the {folder} does not exists in the archive.
   */
  registerMediaFolder(type_name: string, folder: string, ...alternative_names: string[]) {
    this.custom_folders[type_name] = [folder, ...alternative_names];
  }

  /*
   * HELPERS
   */

  protected static autoDetectStoreType(archive: ConstructibleArchives) : ArchiveDMImagesFormation {
    if (archive.searchDir(/direct_message_media/).length) {
      const folder = archive.dir('direct_message_media');
      const query = folder.search(/\.zip$/);
      if (query.length) {
        return "zipped";
      }
      return "inside";
    }
    if (archive.searchDir(/direct_messages_media/).length) {
      const folder = archive.dir('direct_messages_media');
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
    if (archive.searchDir(/direct_messages_group_media/).length) {
      const folder = archive.dir('direct_message_group_media');
      const query = folder.search(/\.zip$/);
      if (query.length) {
        return "zipped";
      }
      return "inside";
    }
    if (archive.searchDir(/tweet_media/).length) {
      const folder = archive.dir('tweet_media');
      const query = folder.search(/\.zip$/);
      if (query.length) {
        return "zipped";
      }
      return "inside";
    }
    if (archive.searchDir(/profile_media/).length) {
      const folder = archive.dir('profile_media');
      const query = folder.search(/\.zip$/);
      if (query.length) {
        return "zipped";
      }
      return "inside";
    }

    return "none";
  }
}

export default MediaArchive;

export class SingleMediaArchive {
  protected _archive: ConstructibleArchives | undefined;
  protected _ready: Promise<void>;
  protected _ok = false;

  constructor(full_archive: ConstructibleArchives | null, dir_name: string | string[]) {
    if (full_archive === null) {
      this._ready = Promise.resolve();
      this._ok = true;
    }
    else {
      if (!full_archive) {
        throw new Error("Archive is not loaded. This is required to load new medias.");
      }

      this._ready = (async () => {
        let real_dir_name = "";
        if (Array.isArray(dir_name)) {
          for (const dir of dir_name) {
            if (full_archive.searchDir(new RegExp(dir)).length) {
              real_dir_name = dir;
            }
          }

          if (!real_dir_name) {
            real_dir_name = dir_name[0];
          }
        }
        else {
          real_dir_name = dir_name;
        }

        const folder = full_archive.dir(real_dir_name);
        const query = folder.search(/\.zip$/);
        if (query.length) {
          this._archive = await folder.fromFile(query[0] as any);
          await this._archive.ready();
        }
        else {
          this._archive = folder;
        }
        this._ok = true;
      })();
    }
  }

  get archive() {
    return this._archive;
  }

  get ok() {
    return this._ok;
  }

  get ready() {
    return this._ready;
  }

  get files() {
    return Object.keys(this._archive.ls(true)).filter(e => e);
  }

  async file<T = true>(name: string, as_array_buffer: T): Promise<ArrayBuffer>;
  async file<T = false>(name: string, as_array_buffer: T): Promise<Blob>;
  async file(name: string, as_array_buffer?: boolean) {
    if (!this._archive || !this._ok) {
      throw new Error("Archive is not loaded or hasn't been initialized properly.");
    }

    const results = this._archive.search(new RegExp(name + "(\.?.*)$"));
  
    if (results.length) {
      if (as_array_buffer === undefined) {
        as_array_buffer = SingleMediaArchive.autoDetectIfArrayBuffer();
      }

      return this._archive.read(results[0] as any, as_array_buffer ? "arraybuffer" : "blob");
    }

    throw new FileNotFoundError("File not found", name);
  }
  
  async sideload(archive: ConstructibleArchives) {
    this._archive = archive;
    this._ok = false;
    await (this._ready = archive.ready());
    this._ok = true;
  }

  protected static autoDetectIfArrayBuffer() {
    return typeof Blob === 'undefined';
  }
}
