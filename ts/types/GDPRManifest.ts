// Contains types of manifest.js file of newer archives (> March 2020)

/** Information about a JS file contaning data related to key. */
export interface ArchiveManifestFileInfo {
  /** Name of the file containing the JSON information related to key. */
  fileName: string;
  /** Name of the global variable declaration at the beginning of the JS file. */
  globalName: string;
  /** Number of items in JS file (in modern GDPR archives, every file contains an array). */
  count: string;
};

export interface ArchiveManifestFileInfoNoMedia {
  files: ArchiveManifestFileInfo[];
}

export interface ArchiveManifestFileInfoWithMedia {
  mediaDirectory: string;
  files: ArchiveManifestFileInfo[];
}

export interface ArchiveManifestFileInfoMediaDirectory {
  mediaDirectory: string;
}

/** Describe each key linked to a `ArchiveManifestFileInfoNoMedia` object. */
export type ArchiveManifestDataTypeNoMedia = "account" | "accountCreationIp" | "accountSuspension" | "accountTimezone" | "adEngagements" |
  "adImpressions" | "adMobileConversionsAttributed" | "adMobileConversionsUnattributed" | "adOnlineConversionsAttributed" | 
  "adOnlineConversionsUnattributed" | "ageinfo" | "block" | "branchLinks" | "connectedApplication" | "contact" | "deviceToken" |
  "directMessageGroupHeaders" | "directMessageHeaders" | "emailAddressChange" | "follower" | "following" | "ipAudit" | "like" |
  "listsCreated" | "listsMember" | "listsSubscribed" | "mute" | "niDevices" | "periscopeAccountInformation" |
  "periscopeBanInformation" | "periscopeBroadcastMetadata" | "periscopeCommentsMadeByUser" | "periscopeExpiredBroadcasts" | "periscopeFollowers" |
  "periscopeProfileDescription" | "personalization" | "phoneNumber" | "protectedHistory" | "savedSearch" |
  "screenNameChange" | "verified";

/** Describe each key linked to a `ArchiveManifestFileInfoWithMedia` object. */
export type ArchiveManifestDataTypeWithMedia = "directMessages" | "directMessagesGroup" | "moment" | "profile" | "tweet";

/** Describe each key linked to a `ArchiveManifestFileInfoMediaDirectory` object. */
export type ArchiveManifestDataTypeMediaDirectory = "directMessagesMedia" | "directMessagesGroupMedia" | "momentsMedia" | 
  "momentsTweetsMedia" | "profileMedia" | "tweetMedia";

export type ArchiveManifestDataTypes = 
{
  [T in ArchiveManifestDataTypeNoMedia]: ArchiveManifestFileInfoNoMedia;
} 
  & 
{
  [T in ArchiveManifestDataTypeWithMedia]: ArchiveManifestFileInfoWithMedia;
} 
  & 
{
  [T in ArchiveManifestDataTypeMediaDirectory]: ArchiveManifestFileInfoMediaDirectory;
};

export interface ArchiveManifest {
  userInfo: {
    /** Refers to `user.id_str` */
    accountId: string;
    /** Refers to `user.screen_name` */
    userName: string;
    /** Refers to `user.name` */
    displayName: string;
  };
  archiveInfo: {
    /** Stringified number of ZIP bytes length. */
    sizeBytes: string;
    /** ISO Date of the archive generation. */
    generationDate: string;
    /** If the archive is partial (?). */
    isArchivePartial: boolean;
    /** Maximum size of a file in this archive. */
    maxPartSizeBytes: string;
  };
  readmeInfo: {
    /** README filename (absolute path). */
    fileName: string;
    /** Where the README file is located. */
    directory: string;
    /** README filename (related path from `directory`) */
    name: string;
  };
  /** 
   * Store links between data type => linked JS file(s). 
   * Also contains location of media directories. 
   */
  dataTypes: ArchiveManifestDataTypes;
}

export default ArchiveManifest;
