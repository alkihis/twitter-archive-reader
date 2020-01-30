Here are a migration guide from 4.0.* to 5.0.0 version of `twitter-archive-reader`.


## Helpers

Since **3.0.0**, helpers for various type of data were located on the related data object they were targeting.

Now, all helpers are available under exported `TwitterHelpers` object. This solution has been preferred to
centralize all helpers, and not polluting top level exports of the module.

Available helpers are:

- `getEventsFromMessages`: For a given list of direct messages, get the related events to them, ordered by ascending date.
- `AdArchive.parseAdDate` **=>** `parseAdDate`: Parse a date inside every ad related data.
- `parseTwitterDate`: Previously exported on top level. Parse the most common dates of the archive.
- `TweetArchive.dateFromTweet` **=>** `dateFromTweet`: Parse the date of a tweet.
- `UserData.parseDeviceDate` **=>** `parseDeviceDate`: Parse the date inside `PushDevice` or `MessagingDevice`.
- `TweetArchive.sortTweets` **=>** `sortTweets`: Sort tweets by ID.
- `TweetArchive.isGDPRTweet` **=>** `isGDPRTweet`: True if the tweet is a GDPR tweet.
- `TweetArchive.isWithMedia` **=>** `isWithMedia`: True if tweet contains medias.
- `TweetArchive.isWithVideo` **=>** `isWithVideo`: True if tweet contain a GIF or a video.


## Dealing with medias

Previously, this package gave only access to direct messages media.

Now, all the medias are available and they can be accessed with `MediaArchive` instance, on `.medias` property of a `TwitterArchive` object.

The following methods of `TwitterArchive` are **removed**:
- `dmImage()`
- `dmImageFromUrl()`
- `dmImagesOf()`

You can learn more about how `MediaArchive` works in [Dealing with medias](./Dealing-with-medias.md) part of the documentation.

Here's the replacement for the deleted methods for DMs:
- `.dmImage(name, is_group, as_array_buffer)` **=>** `.medias.get(is_group ? MediaArchiveType.GroupDM : MediaArchiveType.SingleDM, name, as_array_buffer)`
- `.dmImageFromUrl(url, is_group, as_ab)` **=>** `.medias.fromDmMediaUrl(url, is_group, as_ab)`
- `.dmImagesOf(dm, as_ab)` **=>** `.medias.ofDm(dm, as_ab)`


## Direct messages events

Since **4.1.0**, `LinkedDirectMessage` objects now handle direct messages events.

Events occurs on group conversations, like the conversation name change or a participant joining the discussion.

To iterate on messages with events, use `Conversation.events(true)` generator.
Learn more about direct message events in 
[Browsing a single DM conversation](./Browsing-a-single-DM-conversation.md).
// TODO refresh this page ^ !


## Archive read event system

When a Twitter archive is read, events are emitted in order to know at which step is the reading.

Before, methods are available on `TwitterArchive` instance in order to get those events, with the DOM events API.

We moved to **Node.js events API**. In order to divide things, events are now emitted to the `.events` property of `TwitterArchive`.

`.addEventListener(name, listener)` **=>** `.events.on(name, listener)`
`.removeEventListener(name, listener)` **=>** `.events.off(name, listener)`

## Other changes

### `.load_images_in_zip` parameter for `TwitterArchive` constructor

This parameter is removed. Medias are now lazy-loaded on first request with medias getter methods of `.medias`.

### `.is_dm_images_available` property of `TwitterArchive`

This property is **deprecated**, please use `.medias.has_medias` instead.

### Type name change

A typo has been fixed, `GPDRProtectedHistory` is now `GDPRProtectedHistory`. Please change your imports.

### `TweetArchive.month()` and `Conversation.month()` now accepts `number` as parameter type

It is now **recommanded** to pass **year** and **month** parameter as `number` instead of `string`.

### `TwitterArchive.raw` property change

This property now only returns a single archive: The loaded ZIP.

