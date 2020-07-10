You can explore archive properties (creation date, owner...) by using the `TwitterArchive` instance.

## Properties / Accessors

- `.length`: Number of tweets in archive.
- `.owner`: User ID of the archive owner.
- `.owner_screen_name`: Screen name of the archive owner.
- `.generation_date`: Archive creation date.
- `.is_gdpr`: True if archive is a GDPR archive.
- `.index`: Raw access to archive information / index. See `ArchiveIndex` interface.

## GDPR archive specificities

Some properties are restricted for the GDPR archive.

- `.messages`: Access to the `DMArchive` instance. Details for this property are available in the Direct Messages section.
- `.extended_gdpr`: Access to GDPR's extended data (favorites, blocks...)

The extended GDPR is not computed, just parsed. This property follow this interface:
```ts
interface ExtendedGDPRInfo {
  followers: Set<string>;
  followings: Set<string>;
  favorites: Set<string>;
  mutes: Set<string>;
  blocks: Set<string>;
  lists: {
    created: string[];
    member_of: string[];
    subscribed: string[];
  };
  personalization: InnerGDPRPersonalization;
  screen_name_history: GPDRScreenNameHistory[];
  protected_history: GPDRProtectedHistory[];
  age_info: InnerGDPRAgeInfo;
  moments: GDPRMoment[];
}
```
For details for the inner types of this interface, see `ts/TwitterTypes.ts` file.

Specific methods:

For details, see [Get a direct message media](./Get-a-direct-message-media.md) part.

- `.dmImage(name: string, is_group: boolean, as_array_buffer: boolean)`: Extract direct message file from its name (returns a `Promise<Blob | ArrayBuffer>`).
- `.dmImageFromUrl(url: string, is_group: boolean, as_array_buffer: boolean)`: Extract direct message file from the Twitter media URL contained in `DirectMessage` object (returns a `Promise<Blob | ArrayBuffer>`).


## Continue

Next page is [Tweet access and manipulating tweets](./Tweet-access-and-manipulating-tweets.md).

