# Files to data structures

> Link between archive files to data structures in twitter-archive-reader module

In order to facilitate reading, `TwitterArchive` instance will be presented as `archive`.

When files contains nested data structures, presented properties are the unwrapped ones.

When a property isn't present/read/stored by `twitter-archive-reader`, a **X** will be used as description.

## GDPR archives: files

This part will link GDPR archive files and properties to used data structures.


### `account.js`

- email: `archive.user.email_address`
- createdVia: **X**
- username: `archive.user.screen_name`
- accountId: `archive.user.id`
- createdAt: `archive.user.created_at`
- accountDisplayName: `archive.user.name`

### `account-creation-ip.js`

- accountId: `archive.user.id`
- userCreationIp: `archive.user.account_creation_ip`

### `account-suspension.js`

Due to lack of information in the package creator dataset, this file could not be parsed.

### `account-timezone.js`

- accountId: `archive.user.id`
- timeZone: `archive.user.timezone`

### `ad-engagements.js`

Every `ad.adsUserData.adEngagements.engagements` array in file is merged into `archive.ads.engagements`.

### `ad-impressions.js`

Every `ad.adsUserData.adImpressions.impressions` array in file is merged into `archive.ads.impressions`.

### `ad-mobile-conversions-attributed.js`

Every `ad.adsUserData.attributedMobileAppConversions.conversions` array in file is merged into `archive.ads.mobile_conversions`.

### `ad-mobile-conversions-unattributed.js`

This file is not parsed.

### `ad-online-conversions-attributed.js`

Every `ad.adsUserData.attributedOnlineConversions.conversions` array in file is merged into `archive.ads.online_conversions`.

### `ad-online-conversions-unattributed.js`

This file is not parsed.

### `ageinfo.js`

- age: `archive.user.age.age`
- birthDate: `archive.user.age.birthDate`

### `block.js`

Every `accountId` in this file is available in `archive.blocks` set.

### `connected-application.js`

Every `connectedApplication` in this file is merged into `archive.user.authorized_applications` array.

### `contact.js`

Due to lack of information in the package creator dataset, this file could not be parsed.

### `device-token.js`

This file is not parsed. (maybe TODO ?)

### `direct-message.js`, `direct-message-partX.js`, `direct-message-group.js`...

All direct messages are available, grouped by conversation, in `archive.messages`.

If you look for events other than direct messages, they're grouped by message and are available in `.events.before` and `.events.after` properties of a `LinkedDirectMessage` object, or via `.events()` generator of a `Conversation` instance.

Direct message "headers" files are not parsed, because their content is the same as direct messages files, but without the text.

### `email-address-change.js`

Every `emailChange` available is grouped in `archive.user.email_address_history` array.

### `follower.js`

Every `accountId` in this file is available in `archive.followers` set.

### `following.js`

Every `accountId` in this file is available in `archive.followings` set.

### `ip-audit.js`

Every `ipAudit` in this file is grouped into `archive.user.last_logins` array. 

### `like.js`

Likes are organisated into `archive.favorites`.
You can get a set of favorited tweets ID with `archive.favorites.registred`, 
and get every `like` object of this file with `archive.favorites.all`.

### `lists-created.js`, `lists-member.js` and `lists-subscribed.js`

Nested URLs of those files are respectively in `archive.lists.created`, 
`archive.lists.member_of` and `archive.lists.subscribed`.

### `moment.js`

Moments are stored in `archive.moments`. You will find every `moment` properties of the file
merged in this array.

Due to lack of data about moments, type definitions maybe incomplete or incorrect, you're warned.

### `mute.js`

Every `accountId` in this file is available in `archive.mutes` set.

### `ni-devices.js`

In this file, every `niDeviceResponse.pushDevice` will be merged in `archive.user.devices.push_devices` array,
and every `niDeviceResponse.messagingDevice` are merged in `archive.user.devices.messaging_devices` array.

### `periscope-*.js` files

Due to lack of information in the package creator dataset about Periscope informations, all files
related to Periscope aren't parsed.

### `personalization.js`

Personalization data is parsed and rearranged in `archive.user.personalization`.
See `UserPersonalization` interface in `types/GDPRUserInformations.ts` for more details about how the data is rearranged.

### `phone-number.js`

- phoneNumber: `archive.user.phone_number`

### `profile.js`

- bio: `archive.user.bio`
- website: `archive.user.url`
- location: `archive.user.location`
- avatarMediaUrl: `archive.user.profile_img_url`
- headerMediaUrl: `archive.user.profile_banner_url`

### `protected-history.js`

Every `protectedHistory` object is stored in an array available at `archive.user.protected_history`.

### `saved-search.js`

Due to lack of information in the package creator dataset, this file could not be parsed.

### `screen-name-change.js`

Every `screenNameChange.screenNameChange` object is stored in an array available at `archive.user.screen_name_history`.

### `tweet.js`, `tweet-partX.js`...

Every tweet is parsed and stored into `archive.tweets` container. 

Some properties can change in GDPR archive tweets in order to ensure compatibility between 
multiple types of archives. To know more about tweets, please see the related documentation 
"Tweet access and manipulating tweets" in the wiki.

### `verified.js`

You can check if archive owner is verified with the boolean `archive.user.verified`.

## GDPR archives: folders

This part will link GDPR archive directories data to `twitter-archive-reader`.

Folders in GDPR archives store **media data**, like tweet images, videos, direct messages and profile medias.

You can access medias with the `MediaArchive` instance, located on the `.medias` property of Twitter Archive Reader.
Some methods available on this object are made to facilitate access to tweet and DM medias. Those methods are
described in the **Dealing with medias** part of the wiki, please refer to it in order to learn more about them.

### Warning 
In archives made between **June 2019** and **December 2019**, media files were zipped inside the archive.
In this case, `twitter-archive-reader` must extract the ZIP from the original archive to read its content.

This cause a huge overhead when first accessing selected media archive, and may be fatal for RAM-limited systems with very big archives.

### Mapping between folders and `MediaArchiveType` enumeration

An enumeration (`MediaArchiveType`) is available to reference each supported folder by `MediaArchive`.
Enumeration items are used with `.get()` and `.list()` methods.

```ts
enum MediaArchiveType {
  SingleDM, GroupDM, Moment, Tweet, Profile
}
```

You can import it as a component `twitter-archive-reader` package.
```ts
import { MediaArchiveType } from 'twitter-archive-reader';
```

Here's the folder list to enum reference.

- `direct_message_media`: **MediaArchiveType.SingleDM**

- `direct_message_group_media`: **MediaArchiveType.GroupDM**

- `tweet_media`: **MediaArchiveType.Tweet**

- `profile_media`: **MediaArchiveType.Profile**
  
- `moments_media`: **MediaArchiveType.Moment**

If other folders are present in the archive, they aren't accessible.


## Classic archives

Classic archives are limited in informations.

### `data/js/payload_details.js`

- tweets: `archive.tweets.length`
- created_at: `archive.generation_date`
- lang: **X**

### `data/js/tweet_index.js`

For every item in tweet index array:

File name and var name are unaccessible.
All the related information to each year/month to tweet count is located in `archive.tweets.index`.

```ts
// Tweet count of 2019/08
const index = archive.tweets.index;

// Index is organized from years to months to tweets IDs
if (2019 in index) {
  if (8 in index[2019]) {
    const tweet_count = Object.keys(index[2019][8]).length;
  }
}
```

### `data/js/user_details.js`

- screen_name: `archive.user.screen_name`
- location: `archive.user.location`
- full_name: `archive.user.name`
- bio: `archive.user.bio`
- id: `archive.user.id`
- created_at: `archive.user.created_at`


### `data/js/tweets/*.js`

Every `.js` file contains tweets, organized per month.
To access tweets indexed per year and month, use `archive.tweets.index`, as previously shown.

You can also use `archive.tweets.month(month, year)`.
