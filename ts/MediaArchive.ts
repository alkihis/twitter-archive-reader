import { AcceptedZipSources, constructArchive, ConstructibleArchives } from "./StreamArchive";
import { PartialTweet, DirectMessage, MediaGDPREntity, PartialTweetMediaEntity } from "./TwitterTypes";
import UserData from "./UserData";

export type ArchiveDMImagesFormation = "none" | "inside" | "zipped";

export enum MediaArchiveType {
  SingleDM = "single-dm", 
  GroupDM = "group-dm", 
  Moment = "moment", 
  Tweet = "tweet", 
  Profile = "profile",
}

export class MediaArchive {
  protected dm_single: SingleMediaArchive | undefined;
  protected dm_group: SingleMediaArchive | undefined;
  protected tweet: SingleMediaArchive | undefined;
  protected profile: SingleMediaArchive | undefined;
  protected moment: SingleMediaArchive | undefined;

  protected static readonly DM_SINGLE_FOLDER = "direct_message_media";
  protected static readonly DM_GROUP_FOLDER = "direct_message_group_media";
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
  * @param from Media archive
  * @param name Filename (exact filename required)
  * @param as_array_buffer True if return type is ArrayBuffer. Otherwise, Blob will be used.
  * By default, returns ArrayBuffer on Node.js and Blob when available.
  */
  async get(from: MediaArchiveType, name: string, as_array_buffer?: boolean) {
    switch (from) {
      case MediaArchiveType.SingleDM: {
        if (!this.dm_single) {
          this.dm_single = new SingleMediaArchive(this.archive, MediaArchive.DM_SINGLE_FOLDER);
        }
        await this.dm_single.ready;

        return this.dm_single.file(name, as_array_buffer);
      }
      case MediaArchiveType.GroupDM: {
        if (!this.dm_group) {
          this.dm_group = new SingleMediaArchive(this.archive, MediaArchive.DM_GROUP_FOLDER);
        }
        await this.dm_group.ready;

        return this.dm_group.file(name, as_array_buffer);
      }
      case MediaArchiveType.Tweet: {
        if (!this.tweet) {
          this.tweet = new SingleMediaArchive(this.archive, MediaArchive.TWEET_FOLDER);
        }
        await this.tweet.ready;

        return this.tweet.file(name, as_array_buffer);
      }
      case MediaArchiveType.Moment: {
        if (!this.moment) {
          this.moment = new SingleMediaArchive(this.archive, MediaArchive.MOMENT_FOLDER);
        }
        await this.moment.ready;

        return this.moment.file(name, as_array_buffer);
      }
      case MediaArchiveType.Profile: {
        if (!this.profile) {
          this.profile = new SingleMediaArchive(this.archive, MediaArchive.PROFILE_FOLDER);
        }
        await this.profile.ready;

        return this.profile.file(name, as_array_buffer);
      }
    }

    throw new Error("Unsupported media type.");
  }

  /**
  * List files available on a specific media archive.
  * 
  * @param of_archive Media archive
  */
  async list(of_archive: MediaArchiveType) {
    switch (of_archive) {
      case MediaArchiveType.SingleDM: {
        if (!this.dm_single) {
          this.dm_single = new SingleMediaArchive(this.archive, MediaArchive.DM_SINGLE_FOLDER);
        }
        await this.dm_single.ready;

        return this.dm_single.files;
      }
      case MediaArchiveType.GroupDM: {
        if (!this.dm_group) {
          this.dm_group = new SingleMediaArchive(this.archive, MediaArchive.DM_GROUP_FOLDER);
        }
        await this.dm_group.ready;

        return this.dm_group.files;
      }
      case MediaArchiveType.Tweet: {
        if (!this.tweet) {
          this.tweet = new SingleMediaArchive(this.archive, MediaArchive.TWEET_FOLDER);
        }
        await this.tweet.ready;

        return this.tweet.files;
      }
      case MediaArchiveType.Moment: {
        if (!this.moment) {
          this.moment = new SingleMediaArchive(this.archive, MediaArchive.MOMENT_FOLDER);
        }
        await this.moment.ready;

        return this.moment.files;
      }
      case MediaArchiveType.Profile: {
        if (!this.profile) {
          this.profile = new SingleMediaArchive(this.archive, MediaArchive.PROFILE_FOLDER);
        }
        await this.profile.ready;

        return this.profile.files;
      }
    }

    throw new Error("Unsupported media type.");
  }

  /*
   * MEDIA GETTERS: PRIVATE
   */

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
  fromDmMediaUrl(url: string, is_group: boolean = false, as_array_buffer?: boolean) {
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
   * @throws If not valid media found, promise is rejected.
   * 
   * ```ts
   * const tweet = archive.tweets[0];
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
   */
  async fromTweetMediaEntity(media_entity: MediaGDPREntity | PartialTweetMediaEntity, as_array_buffer?: boolean) {
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

  async loadArchive(parts: {
    dm_single_archive?: AcceptedZipSources | Promise<AcceptedZipSources>,
    dm_group_archive?: AcceptedZipSources | Promise<AcceptedZipSources>,
    moment_archive?: AcceptedZipSources | Promise<AcceptedZipSources>,
    tweet_archive?: AcceptedZipSources | Promise<AcceptedZipSources>,
    profile_archive?: AcceptedZipSources | Promise<AcceptedZipSources>
  }) {
    if (parts.dm_group_archive) {
      this.dm_group = new SingleMediaArchive(null, "");
      await this.dm_group.sideload(constructArchive(await parts.dm_group_archive));
    }
    if (parts.dm_single_archive) {
      this.dm_single = new SingleMediaArchive(null, "");
      await this.dm_single.sideload(constructArchive(await parts.dm_single_archive));
    }
    if (parts.moment_archive) {
      this.moment = new SingleMediaArchive(null, "");
      await this.moment.sideload(constructArchive(await parts.moment_archive));
    }
    if (parts.tweet_archive) {
      this.tweet = new SingleMediaArchive(null, "");
      await this.tweet.sideload(constructArchive(await parts.tweet_archive));
    }
    if (parts.profile_archive) {
      this.profile = new SingleMediaArchive(null, "");
      await this.profile.sideload(constructArchive(await parts.profile_archive));
    }
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
    if (archive.searchDir(/direct_message_group_media/).length) {
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

  constructor(full_archive: ConstructibleArchives | null, dir_name: string) {
    if (full_archive === null) {
      this._ready = Promise.resolve();
      this._ok = true;
    }
    else {
      if (!full_archive) {
        throw new Error("Archive is not loaded. This is required to load new medias.");
      }

      this._ready = (async () => {
        const folder = full_archive.dir(dir_name);
        const query = folder.search(/\.zip$/);
        if (query.length) {
          this._archive = await folder.fromFile(query[0] as any);
          await this._archive.ready();
        }
        else {
          this._archive = full_archive.dir(dir_name);
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

    throw new Error("File not found");
  }
  
  async sideload(archive: ConstructibleArchives) {
    this._archive = archive;
    this._ok = false;
    await archive.ready();
    this._ok = true;
  }

  protected static autoDetectIfArrayBuffer() {
    return typeof Blob === 'undefined';
  }
}
