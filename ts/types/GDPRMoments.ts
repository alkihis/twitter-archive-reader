
export type GDPRMomentFile = {
  moment: GDPRMoment;
}[];

export interface GDPRMoment {
  momentId: string;
  createdAt: string;
  createdBy: string;
  title: string;
  coverMediaUrls: string[];
  tweets: GDPRTweetMoment[];
}

export interface GDPRTweetMoment {
  momentId: string;
  tweet: {
    deviceSource: {
      name: string;
      parameter: string;
      url: string;
      internalName:string;
      id: string;
      clientAppId: string;
      display: string;
    };
    urls: unknown[];
    coreData: {
      nsfwUser: boolean;
      createdVia: string;
      nsfwAdmin: boolean;
      createdAtSecs: string;
      text: string;
      conversationId: string;
      userId: string;
      hasMedia: true;
    };
    id: string;
    language: {
      language: string;
      rightToLeft: boolean;
      confidence: string;
    };
    media: GDPRMomentTweetMedia[];
    mentions: unknown[];
  }
}

export interface GDPRMomentTweetMedia {
  expandedUrl: string;
  mediaInfo: {
    imageInfo: {};
  };
  url: string;
  nsfw: boolean;
  toIndex: string;
  mediaUrl: string;
  mediaPath: string;
  displayUrl: string;
  mediaUrlHttps: string;
  mediaKey: {
    mediaCategory: MomentImageContent;
    mediaId: string;
  };
  isProtected: boolean;
  mediaId: string;
  sizes: {
    resizeMethod: MomentImageContent;
    deprecatedContentType: MomentImageContent;
    sizeType: MomentImageContent;
    height: string;
    width: string;
    faces?: {
      boundingBox: {
        left: string;
        width: string;
        top: string;
        height: string;
      };
    }[];
  }[];
}

interface MomentImageContent {
  value: string;
  name: string;
  originalName: string;
  annotations: {};
}
