import TwitterArchive from "./index";
import { ArchiveSave, GDPRConversation, DMFile } from "./TwitterTypes";
import Conversation from "./Conversation";
import JSZip from 'jszip';

export const SUPPORTED_SAVE_VERSIONS = ["1.0.0"];

export default async function createSaveFrom(archive: TwitterArchive) {
  const info = archive.synthetic_info;
  info.hash = TwitterArchive.hash(info);

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

  const tweets = archive.all;
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

  return {
    tweets: tweet_zip,
    dms,
    info,
    mutes,
    blocks,
    screen_name_history: archive.extended_gdpr ? archive.extended_gdpr.screen_name_history : []
  };
}

export async function createFromSave(save: ArchiveSave | Promise<ArchiveSave>) {
  save = await save;

  if (!SUPPORTED_SAVE_VERSIONS.includes(save.info.version)) {
    throw new Error("Save version is not supported.");
  }

  const archive = new TwitterArchive(null);

  archive.index.archive = save.info.index.archive;
  archive.index.info = save.info.index.info;

  const tweet_archive = await JSZip.loadAsync(save.tweets);
  let current_load_object = JSON.parse(await tweet_archive.file("tweet.json").async("text"));

  // Tweets are extracted from a previous archive, they've been converted to classic format.
  archive.loadClassicArchivePart({ tweets: current_load_object });
  current_load_object = undefined;

  if (save.info.is_gdpr) {
    // Side effect of this method is to define archive to GDPR format
    archive.loadArchivePart();
  }

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
