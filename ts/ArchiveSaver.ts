import TwitterArchive from "./index";
import { GDPRConversation, DMFile, ScreenNameChange, GPDRScreenNameHistory, ArchiveSyntheticInfo, PartialFavorite } from "./TwitterTypes";
import Conversation from "./Conversation";
import JSZip from 'jszip';

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
}

export const SUPPORTED_SAVE_VERSIONS = ["1.0.0", "1.1.0"];
export const CURRENT_EXPORT_VERSION = "1.1.0";

export default async function createSaveFrom(archive: TwitterArchive) : Promise<ArchiveSave> {
  const info = archive.synthetic_info;

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

  const tweets = archive.tweets.all;
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

  const mutes = archive.extended_gdpr ? [...archive.extended_gdpr.mutes] : [];
  const blocks = archive.extended_gdpr ? [...archive.extended_gdpr.blocks] : [];

  let dms: ArrayBuffer = null;
  if (archive.is_gdpr && archive.messages) {
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

  info.version = CURRENT_EXPORT_VERSION;

  return {
    tweets: tweet_zip,
    dms,
    info,
    mutes,
    blocks,
    screen_name_history: archive.user.screen_name_history ? archive.user.screen_name_history  : [],
    favorites: archive.favorites.all
  };
}

export async function createFromSave(save: ArchiveSave | Promise<ArchiveSave>) {
  save = await save;

  if (!SUPPORTED_SAVE_VERSIONS.includes(save.info.version)) {
    throw new Error("Save version is not supported.");
  }

  const archive = new TwitterArchive(null);

  const tweet_archive = await JSZip.loadAsync(save.tweets);
  let current_load_object = JSON.parse(await tweet_archive.file("tweet.json").async("text"));

  // Tweets are extracted from a previous archive, they've been converted to classic format.
  archive.loadClassicArchivePart({ tweets: current_load_object, user: save.info.info.user });
  current_load_object = undefined;

  if (save.info.is_gdpr) {
    // Side effect of this method is to define archive to GDPR format
    await archive.loadArchivePart();
  }

  if (save.dms) {
    const dm_archive = await JSZip.loadAsync(save.dms);
    current_load_object = JSON.parse(await dm_archive.file("dm.json").async("text")) as DMFile;

    await archive.loadArchivePart({
      dms: [current_load_object]
    });
  }
  if (archive.is_gdpr) {
    await archive.loadArchivePart({
      mutes: save.mutes,
      blocks: save.blocks
    });

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

function isGdprSNHArray(array: ScreenNameChange[] | GPDRScreenNameHistory[]) : array is GPDRScreenNameHistory[] {
  if (array.length) {
    return 'screenNameChange' in array[0];
  }
  return false;
}
