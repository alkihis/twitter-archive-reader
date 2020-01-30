Twitter store a really big amount of data about one account. This object helps to explore it.

## Access

Access user data (`UserData` instance) with `.user` property of a `TwitterArchive`.

## Basics

Those properties are accessible for both GDPR and classic archives.

- `.id: string`: User ID.
- `.screen_name: string`: User screen name, also called Twitter @.
- `.bio: string`: User profile biography.
- `.created_at: string`: User account creation date, string format. 
You can parse it safely (format may vary) with exported function `parseTwitterDate()` of the module.
- `.name: string`: User name, also called TN.
- `.location: string`: If user has specified a location to its profile, it will be here.

## Basic, GDPR only

Those properties will be filled or defined only if `archive.is_gdpr === true`.

- `.profile_img_url: string`: If user have a profile picture, it will be here.
- `.email_address: string`: User current email address.
- `.phone_number: string`: If user have registred a phone number on Twitter, it will be here.
- `.verified: boolean`: True if user is verified on Twitter (the blue check on the profile).
- `.timezone: string`: User timezone. Format may be strange.
- `.account_creation_ip: string`: IP address used to create this Twitter account.


## Advanced

To parse string dates available on certain properties, use the exported function `parseTwitterDate()` of the module.

### `.devices`

Access to mobile devices used on Twitter.

See `PushDevice` and `MessagingDevice` interfaces.

#### `.devices.push_devices`

Array of devices that used to receive push notifications from Twitter.

#### `.devices.messaging_devices`

Array of devices used to validate Twitter's 2FA.


### `.last_logins`

Array of opened sessions up to 7 days until archive creation.
One session is a single `IpAudit`.

```ts
interface IpAudit {
  createdAt: Date;
  loginIp: string;
}
```

### `.authorized_applications`

Applications authorized to use user's Twitter account.
One application is a `ConnectedApplication`.
```ts
interface ConnectedApplication {
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
}
```

### `.age`

Age information inferred by Twitter or set by the user.
The property follows the `UserFullAgeInfo` interface.
```ts
interface UserAgeInfo {
  /** Can be a single age or a interval of age */
  age: number | [number, number];
  birthDate: string;
}

interface UserFullAgeInfo extends UserAgeInfo {
  /** Inferred info by Twitter about user's age. */
  inferred?: UserAgeInfo;
}
```

### `.email_address_history`

Array of changes into account email addresses.
Each item fulfill the `UserEmailAddressChange` interface.
```ts
interface UserEmailAddressChange {
  changedAt: Date;
  changedTo: string;
  changedFrom?: string;
}
```

### `.personalization`

Inferred affinities about user: Shows, interests.

Inferred informations about user: Gender, language.

See `UserPersonalization` interface.

### `.protected_history`

Each change into tweet protection (max age 90 days) is notified here.

### `.screen_name_history`

Notify every change of screen name (Twiter @). 
Array of changes is sorted from the first @ to the last used.
Each item fulfill the `ScreenNameChange` interface.
```ts
interface ScreenNameChange {
  /** When user changed its @ */
  changedAt: string;
  /** @ before the change */
  changedFrom: string;
  /** @ after the change */
  changedTo: string;
}
```

## Continue

Next page is [Tweet access and manipulating tweets](./Tweet-access-and-manipulating-tweets).

