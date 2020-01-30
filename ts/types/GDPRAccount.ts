
export type AccountGDPR = [{
  account: AccountGDPREntity
}];

export interface AccountGDPREntity {
  email: string;
  /** Platform used to create account */
  createdVia: string;
  /** user.screen_name */
  username: string;
  /** user.id_str */
  accountId: string;
  /** user.created_at */
  createdAt: string;
  /** user.name */
  accountDisplayName: string;
}

export type ProfileGDPR = [{
  profile: ProfileGDPREntity
}];

export interface ProfileGDPREntity {
  description: {
    /** user.description */
    bio: string;
    /** user.url */
    website: string;
    location: string;
  },
  /** user.profile_image_url_https */
  avatarMediaUrl: string;
  /** user.profile_banner_url */
  headerMediaUrl?: string;
}

