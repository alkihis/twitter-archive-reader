import TwitterArchive from "./index";
import { GDPRConversation, DMFile, ScreenNameChange, GPDRScreenNameHistory, ArchiveSyntheticInfo, PartialFavorite, PartialTweet, GDPRMoment, AdImpression, AdEngagement, AdMobileConversion, AdOnlineConversion, DirectMessageEventContainer, DirectMessageEventsContainer } from "./TwitterTypes";
import Conversation from "./Conversation";
import JSZip from 'jszip';
import { UserLoadObject } from "./UserData";

function convertConversationToGDPRConversation(conversation: Conversation) : GDPRConversation {
  let first = true;
  const msgs: DirectMessageEventContainer[] = [];

  function addEvents(e: DirectMessageEventsContainer) {
    for (const [key, vals] of Object.entries(e)) {
      for (const val of vals) {
        msgs.push({ [key]: val });
      }
    }
  }

  for (const msg of conversation.all) {
    if (first) {
      first = false;
      if (msg.events && msg.events.before) {
        addEvents(msg.events.before)
      }
    }
  
    msgs.push({ messageCreate: {
      recipientId: msg.recipientId,
      createdAt: msg.createdAt,
      mediaUrls: msg.mediaUrls,
      text: msg.text,
      senderId: msg.senderId,
      id: msg.id
    }});

    if (msg.events && msg.events.after) {
      addEvents(msg.events.after);
    }
  }

  return {
    dmConversation: {
      conversationId: conversation.id,
      messages: msgs
    }
  };
}

function isGdprSNHArray(array: ScreenNameChange[] | GPDRScreenNameHistory[]) : array is GPDRScreenNameHistory[] {
  if (array.length) {
    return 'screenNameChange' in array[0];
  }
  return false;
}

export interface ArchiveSave {
  tweets: ArrayBuffer;
  dms: ArrayBuffer;
  info: ArchiveSyntheticInfo;
  mutes: string[];
  blocks: string[];
  /** 1.0.0: `GPDRScreenNameHistory[]` ; 1.1.0+: `ScreenNameChange[]` */
  screen_name_history: ScreenNameChange[] | GPDRScreenNameHistory[];
  /** 1.1.0+ */
  favorites?: PartialFavorite[];
  /** 1.1.0+ */
  user?: UserLoadObject;

  followers?: string[];
  followings?: string[];
  moments?: GDPRMoment[];
  lists?: {
    created: string[];
    member_of: string[];
    subscribed: string[];
  };
  ad_archive?: ArrayBuffer;
}

export interface ArchiveSaveOptions {
  tweets?: boolean;
  dms?: boolean;
  mutes?: boolean;
  favorites?: boolean;
  blocks?: boolean;
  followers?: boolean;
  followings?: boolean;
  moments?: boolean;
  lists?: boolean;
  ad_archive?: boolean;

  /** Summary user data and screen name history is always stored. */
  user?: {
    phone_number?: boolean, 
    verified?: boolean, 
    personalization?: boolean, 
    protected_history?: boolean, 
    age_info?: boolean, 
    email_address_changes?: boolean, 
    login_ips?: boolean, 
    timezone?: boolean, 
    applications?: boolean
  };
}

export class ArchiveSaver {
  static readonly SUPPORTED_SAVE_VERSIONS = ["1.0.0", "1.1.0"];
  static readonly CURRENT_EXPORT_VERSION = "1.1.0";
  
  /**
   * Create a save from a Twitter Archive.
   * 
   * Restore an `ArchiveSave` with `.restore()`.
   * 
   * Default parameter for {options} is:
   * ```ts
   * options = {
   *  tweets: true, 
   *  dms: true, 
   *  mutes: true, 
   *  favorites: true, 
   *  blocks: true,
   *  user: {}
   * }
   * ```
   */
  static async create(archive: TwitterArchive, options: ArchiveSaveOptions = {
    tweets: true, 
    dms: true, 
    mutes: true, 
    favorites: true, 
    blocks: true,
    user: {},
  }) : Promise<ArchiveSave> {
    const info = archive.synthetic_info;

    let tweet_zip: ArrayBuffer;
    if (options.tweets) {
      const tweets = archive.tweets.all;
      for (const tweet of tweets) {
        delete tweet.created_at_d;
      }
  
      tweet_zip = await new JSZip().file("tweet.json", JSON.stringify(tweets)).generateAsync({
        type: "arraybuffer",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6 // Not too much, if we want a good generation time
        }
      });
    }

    const mutes = options.mutes ? [...archive.mutes] : [];
    const blocks = options.blocks ? [...archive.blocks] : [];

    let dms: ArrayBuffer = null;
    if (options.dms && archive.is_gdpr && archive.messages) {
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
          JSON.stringify(archive.messages.all.map(convertConversationToGDPRConversation))
        )
        .generateAsync({
          type: "arraybuffer",
          compression: "DEFLATE",
          compressionOptions: {
            level: 6 // Not too much, if we want a good generation time
          }
        });
    }

    info.version = this.CURRENT_EXPORT_VERSION;

    let ads: ArrayBuffer = null;
    if (options.ad_archive) {
      const all = JSON.stringify({  
        impressions: archive.ads.impressions,
        engagements: archive.ads.engagements,
        mobile_conversions: archive.ads.mobile_conversions,
        online_conversions: archive.ads.online_conversions,
      });

      ads = await new JSZip()
        .file(
          "ads.json", 
          all
        )
        .generateAsync({
          type: "arraybuffer",
          compression: "DEFLATE",
          compressionOptions: {
            level: 6 // Not too much, if we want a good generation time
          }
        });
    }

    const save: ArchiveSave = {
      tweets: tweet_zip,
      dms,
      info,
      mutes,
      blocks,
      followers: options.followers ? [...archive.followers] : undefined,
      followings: options.followings ? [...archive.followings] : undefined,
      moments: options.moments ? archive.moments : undefined,
      lists: options.lists ? archive.lists : undefined,
      ad_archive: ads,
      screen_name_history: archive.user.screen_name_history,
      favorites: options.favorites ? archive.favorites.all : [],
      user: {},
    };

    // Userdata ok
    if (options.user && Object.keys(options.user).length) {
      for (const [name, value] of Object.entries(archive.user.dump())) {
        if (value && name in options.user) {
          // @ts-ignore
          save.user[name] = value;
        }
      }
    }

    return save;
  }

  /**
   * Create a Twitter Archive from an `ArchiveSave`.
   */
  static async restore(save: ArchiveSave | Promise<ArchiveSave>) {
    save = await save;

    if (!this.SUPPORTED_SAVE_VERSIONS.includes(save.info.version)) {
      throw new Error("Save version is not supported.");
    }

    const archive = new TwitterArchive(null);
    const save_info = save.info;
    if (save.info.version === "1.0.0" && 'index' in save_info) {
      // @ts-ignore
      archive.loadClassicArchivePart({ user: save_info.index.info });
    }
    else {
      archive.loadClassicArchivePart({ user: save_info.info.user });
    }

    if (save.tweets) {
      const tweet_archive = await JSZip.loadAsync(save.tweets);
      let current_load_object = JSON.parse(await tweet_archive.file("tweet.json").async("text"));
  
      // Tweets are extracted from a previous archive, they've been converted to classic format.
      archive.loadClassicArchivePart({ tweets: current_load_object });
    }

    if (save.info.is_gdpr) {
      // Side effect of this method is to define archive to GDPR format
      await archive.loadArchivePart();
    }

    if (save.dms) {
      const dm_archive = await JSZip.loadAsync(save.dms);
      let current_load_object = JSON.parse(await dm_archive.file("dm.json").async("text")) as DMFile;

      await archive.loadArchivePart({
        dms: [current_load_object]
      });
    }

    if (save.mutes && save.mutes.length) {
      await archive.loadArchivePart({
        mutes: save.mutes,
      });
    }
    if (save.blocks && save.blocks.length) {
      await archive.loadArchivePart({
        blocks: save.blocks,
      });
    }
    if (save.followers && save.followers.length) {
      await archive.loadArchivePart({
        followers: save.followers,
      });
    }
    if (save.followings && save.followings.length) {
      await archive.loadArchivePart({
        followings: save.followings,
      });
    }
    if (save.moments && save.moments.length) {
      await archive.loadArchivePart({
        moments: save.moments,
      });
    }
    if (save.lists) {
      archive.lists.created = save.lists.created;
      archive.lists.member_of = save.lists.member_of;
      archive.lists.subscribed = save.lists.subscribed;
    }
    if (save.ad_archive) {
      const ad_archive = await JSZip.loadAsync(save.ad_archive);
      let current_load_object = JSON.parse(await ad_archive.file("ads.json").async("text")) as any;

      archive.ads.impressions = current_load_object.impressions;
      archive.ads.engagements = current_load_object.engagements;
      archive.ads.online_conversions = current_load_object.online_conversions;
      archive.ads.mobile_conversions = current_load_object.mobile_conversions;
    }
    if (save.user) {
      archive.user.loadPart(save.user);
    }
    if (archive.is_gdpr) {
      if (save.favorites) {
        archive.favorites.add(save.favorites);
      }

      // Sideload screen name history
      const sn_h = save.screen_name_history;
      if (isGdprSNHArray(sn_h)) {
        archive.user.loadPart({
          screen_name_history: sn_h.map(e => e.screenNameChange)
        });
      }
      else {
        archive.user.loadPart({
          screen_name_history: sn_h
        });
      }
    }

    return archive;
  }
}

export default ArchiveSaver;
