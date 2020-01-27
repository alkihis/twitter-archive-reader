import { BaseArchive, AcceptedZipSources, constructArchive } from "./StreamArchive";
import { PartialTweet, DirectMessage, MediaGDPREntity } from "./TwitterTypes";

export type ArchiveDMImagesFormation = "none" | "inside" | "zipped";

export enum MediaArchiveType {
  SingleDM, GroupDM, Moment, Tweet, Profile,
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

  constructor(protected archive: BaseArchive<any>) { 
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
      return this.fromDmDirectory(id + "-" + image, is_group, as_array_buffer)
    }
    return Promise.reject("URL is invalid");
  }

  /** 
   * Extract a direct message image from GDPR archive (exact filename required). 
   * 
   * @param name Media filename 
   */
  async fromDmDirectory(name: string, is_group: boolean = false, as_array_buffer?: boolean) : Promise<Blob | ArrayBuffer> {
    if (is_group) {
      return this.get(MediaArchiveType.GroupDM, name, as_array_buffer);
    }
    else {
      return this.get(MediaArchiveType.SingleDM, name, as_array_buffer);
    }
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
   */
  async fromTweetMediaEntity(media_entity: MediaGDPREntity, as_array_buffer?: boolean) {
    if (media_entity.video_info) {
      // This is a gif or a video
      // Find the best variant
      const mp4s = media_entity.video_info.variants.filter(v => v.content_type === "video/mp4").filter(v => v.bitrate);

      if (mp4s) {
        const better = mp4s.sort((a, b) => Number(b.bitrate) - Number(a.bitrate))[0];

        const url = better.url.split('/').pop();
        const url_without_qs = url.split('?')[0];
        if (url_without_qs) {
          return this.fromTweetDirectory(url_without_qs, as_array_buffer);
        }
      }
    }
  
    const url = media_entity.media_url_https.split('/').pop();
    const url_without_qs = url.split('?')[0];
    if (url_without_qs) {
      return this.fromTweetDirectory(url_without_qs, as_array_buffer);
    }
    throw new Error("No valid file in this media entity.");
  }

  /** 
   * Extract a tweet image from GDPR archive (exact filename required).
   * 
   * @param name Media filename 
   */
  async fromTweetDirectory(name: string, as_array_buffer?: boolean) : Promise<Blob | ArrayBuffer> {
    return this.get(MediaArchiveType.Tweet, name, as_array_buffer);
  }


  // -----------
  // - Profile -
  // -----------

  /** 
   * Extract a profile image from GDPR archive (exact filename required). 
   * 
   * To get the exact name of the file, take the `profile_img_url` or `profile_banner_url`, and split by `/`. Take the last part.
   * 
   * ```ts
   * const img_name = archive.user.profile_img_url.split('/').pop();
   * 
   * if (img_name) {
   *  const img = await archive.medias.fromProfileDirectory(img_name);
   * }
   * ```
   * 
   * @param name Media filename 
   */
  async fromProfileDirectory(name: string, as_array_buffer?: boolean) : Promise<Blob | ArrayBuffer> {
    return this.get(MediaArchiveType.Profile, name, as_array_buffer);
  }


  // -----------
  // - Moments -
  // -----------

  /** 
   * Extract a moment header image from GDPR archive (exact filename required). 
   * 
   * In order to have tweets medias inside the moments (duplicated by Twitter in the archive, use `.ofTweet(tweet)`).
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

  protected static autoDetectStoreType(archive: BaseArchive<any>) : ArchiveDMImagesFormation {
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
  protected _archive: BaseArchive<any> | undefined;
  protected _ready: Promise<void>;
  protected _ok = false;

  constructor(full_archive: BaseArchive<any> | null, dir_name: string) {
    if (full_archive === null) {
      this._ready = Promise.resolve();
      this._ok = true;
    }
    else {
      if (!full_archive) {
        throw new Error("Archive is not loaded. This is required to load new medias.");
      }

      this._ready = Promise.resolve().then(async () => {
        const folder = full_archive.dir(dir_name);
        const query = folder.search(/\.zip$/);
        if (query.length) {
          this._archive = await folder.fromFile(query[0]);
          await this._archive.ready();
        }
        else {
          this._archive = full_archive.dir(dir_name);
        }
        this._ok = true;
      });
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

      return this._archive.read(results[0], as_array_buffer ? "arraybuffer" : "blob");
    }

    throw new Error("File not found");
  }
  
  async sideload(archive: BaseArchive<any>) {
    this._archive = archive;
    await archive.ready();
  }

  protected static autoDetectIfArrayBuffer() {
    return typeof Blob === 'undefined';
  }
}
