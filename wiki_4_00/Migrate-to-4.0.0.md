Here are a changelog / migration guide from 3.x.x to 4.0.0 version of `twitter-archive-reader`.

## Changed
### TwitterArchive

#### constructor

The `TwitterArchive` constructor now takes two parameters: file and options.

Options available are described by the `TwitterArchiveLoadOptions` interface:
```ts
interface TwitterArchiveLoadOptions {
  load_images_in_zip?: boolean,
  build_ad_archive?: boolean,
}
```

- `load_images_in_zip` have the same effect as before
- New parameter `build_ad_archive` let you choose if you want to parse advertiser data. As those kind of data might be heavy, this is **not enabled by default**.

Option `keep_loaded` is removed.
You can release the ZIP at any time with new method `.releaseZip()` and check if its loaded with `.is_zip_loaded`.

Option `build_extended_gdpr` is removed. "Extended" data is now systematically built.

#### Properties

Most of the data that was before in `.extended_gdpr` property is moved to accessors in `TwitterArchive` instances.

- `.extended_gdpr.moments` **=>** `.moments`: Access to Twitter moments
- `.extended_gdpr.lists` **=>** `.lists`: Access to created and subscribed lists
- `.extended_gdpr.followers` **=>** `.followers`: Set of followers IDs
- `.extended_gdpr.followings` **=>** `.followings`: Set of user IDs following the archive owner
- `.extended_gdpr.mutes` **=>** `.mutes`: Set of muted user IDs
- `.extended_gdpr.blocks` **=>** `.blocks`: Set of blocked user IDs
- `.extended_gdpr.favorites` **=>** `.favorites`: New `FavoriteArchive` instance. See **new features** for more details

If these accessors are invoked with a classic archive, containers will be empty (*empty array, or empty set*).

**Property `.extended_gdpr` is removed.**

Remaining old properties are now stored in the new `UserData` instance (see **new features**).

Other changes on properties:

- `.requires_dm_image_load` **=>** `!.is_dm_images_available`: Property is inverted and renamed for more consistency.
- `.owner` **=>** `.user.id`
- `.owner_screen_name` **=>** `.user.screen_name`: All user-related data is now stored in `.user` property


## New
### UserData

Store all of archive owner related user data.

Accessible through `.user` property of a `TwitterArchive` instance.

Contains screen name, name, user ID, screen name history, protected history...
See related documentation to know more.

### AdArchive

Store data about Twitter seen/engaged ads.

Accessible through `.ads` property of a `TwitterArchive` instance.

#### Initialization
This container is initialized only if `build_ad_archive` constructor option is set to `true`.
If you haven't init this at construct time, you can still load it (if the ZIP is still loaded) with `.loadArchivePart({ current_ad_archive: true })`:

```ts
if (archive.is_zip_loaded) {
  await archive.loadArchivePart({ current_ad_archive: true });
}
```

### FavoriteArchive

Store data about favorited tweets.

Accessible through `.favorites` property of a `TwitterArchive` instance.

Since 2019, favorites inside archives might be associated with favorited tweet text. 
Data type of a favorite now follows this interface: 
```ts
interface PartialFavorite {
  tweetId: string;
  /** Text of the favorited tweet. Defined only if archive creation > around June 2019. */
  fullText?: string;
  /** URL to the tweet. Defined only if archive creation > around June 2019. */
  expandedUrl?: string;
}
```

This container allows quick access to those kind of data:

- `.all: PartialFavorite[]`: Get all favorited tweets informations
- `.has(tweet_id: string): boolean`: Check if a tweet is favorited
- `.get(tweet_id: string): PartialFavorite`: If favorite exists, get information
- `.registred: Set<string>`: Set of favorited tweet IDs (as present in old `.extended_gdpr`)
- `.length: number`: Favorite count
- `.has_extended_favorites: boolean`: True if this `FavoriteArchive` has favorites with `fullText` and `expandedUrl` properties

This object is iterable.

### DMArchive

New method `.conversationOf(dm_id: string)` allows you to get the related conversation of a direct message.


