
/*
 * Types for files 
 */

export type GDPRAgeInfo = [{
  ageMeta: InnerGDPRAgeInfo;
}];

export interface InnerGDPRAgeInfo {
  ageInfo: {
    age: string[];
    birthDate: string;
  },
  inferredAgeInfo?: {
    age: string[];
    birthDate: string;
  }
}

export type GDPRPersonalizaion = {
  p13nData: InnerGDPRPersonalization;
}[];

export interface InnerGDPRPersonalization {
  demographics: {
    languages: {
      language: string;
      isDisabled: boolean;
    }[];
    genderInfo: {
      gender: string;
    }
  };
  interests: {
    interests: {
      name: string;
      isDisabled: boolean;
    }[];
    partnerInterests: unknown[];
    audienceAndAdvertisers: {
      numAudiences: string;
      advertisers: string[];
    };
    shows: string[];
  };
  locationHistory: unknown[];
  inferredAgeInfo?: {
    age: string[];
    birthDate: string;
  };
}

/*
 * Types for storage in package 
 */

// ageinfo.js
/**
 * Every property can be undefined, because Twitter does not provide data systematically.
 */
export interface UserFullAgeInfo extends Partial<UserAgeInfo> {
  inferred?: UserAgeInfo;
}

export interface UserAgeInfo {
  /** Can be a single age or a interval of age */
  age: number | [number, number];
  birthDate: string;
}

// connected-application.js
export interface ConnectedApplication {
  organization: {
    /** App organization name */
    name: string;
    /** App organization URL */
    url?: string;
    /** App organization privacy policy URL */
    privacyPolicyUrl?: string;
  }
  /** App name */
  name: string;
  /** App description */
  description: string;
  /** Date of application access approval */
  approvedAt: Date;
  /** OAuth permissions */
  permissions: ("read" | "write")[];
  /** Application ID */
  id: string;
  /** ?? Don't know what this thing refers to. Maybe the user who created the app (not sure at all). */
  userId?: string;
}

// email-address-change.js
export interface UserEmailAddressChange {
  changedAt: Date;
  changedTo: string;
  changedFrom?: string;
}

// ip-audit.js
export interface IpAudit {
  createdAt: Date;
  loginIp: string;
}

// ni-devices.js
export interface PushDevice {
  deviceVersion: string;
  deviceType: string;
  token?: string;
  /** WARNING: For now (2020-01-01), this date format is "YYYY.MM.DD". This can evolve.
   * Use `TwitterHelpers.parseDeviceDate()` to parse this type of date.
   */
  updatedDate: string;
  /** WARNING: For now (2020-01-01), this date format is "YYYY.MM.DD". This can evolve.
   * Use `TwitterHelpers.parseDeviceDate()` to parse this type of date.
   */
  createdDate: string;
}

export interface MessagingDevice {
  deviceType: string;
  carrier: string;
  /** Phone number, prefix by +<country number> */
  phoneNumber: string;
  /** WARNING: For now (2020-01-01), this date format is "YYYY.MM.DD". This can evolve.
   * Use `TwitterHelpers.parseDeviceDate()` to parse this type of date.
   */
  createdDate: string;
}

// personalization.js
export interface UserPersonalization {
  demographics: {
    languages: string[];
    gender: string;
  };
  interests: {
    names: string[];
    partnerInterests: unknown[];
    advertisers: string[];
    shows: string[];
  }
}

// screen-name-change.js
export interface GPDRScreenNameHistory {
  accountId: string;
  screenNameChange: ScreenNameChange;
}

export interface ScreenNameChange {
  /** When user changed its @ */
  changedAt: string;
  /** @ before the change */
  changedFrom: string;
  /** @ after the change */
  changedTo: string;
}

// protected-history.js
export interface GDPRProtectedHistory {
  protectedAt: string;
  action: "Protect" | "Unprotect";
}
/** @deprecated This is a typo. Please do not use it anymore. */
export type GPDRProtectedHistory = GDPRProtectedHistory;
