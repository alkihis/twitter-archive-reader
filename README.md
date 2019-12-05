# twitter-archive-reader

> Read data from classic Twitter archive and GDPR archive

This module helps to read data from Twitter archives.

## Foreword

This module is developed in mind to treat classic and GDPR archives the same way.

Tweets registered in GDPR archive are not well-formed: sometimes, long tweets (140+ characters)
are truncated (without possibility to read a longer version) and retweet data is not present.

Unobtenaible data will be infereed from patterns (like tweets beginning with `RT @...` for retweets) in
order to convert them in a classic format.

Quoted tweet data are, for both types of archives, inexistant.

This module use **BigInt**, so at least **Node 10.4** or a **`BigInt` compatible browser** is *recommanded*.

Module will use a fallback to `big-integer` npm module if `BigInt` does not exists.
**Please note that, for performance reasons, a `BigInt` compatible system is hugely recommanded.**


## Getting started

Install package using NPM.

```bash
npm i twitter-archive-reader
```

This package internally use [JSZip](https://stuk.github.io/jszip/documentation) to read ZIP archives, you can load archives in this module the same way you load them in JSZip.

```ts
// ESModules
import TwitterArchive from 'twitter-archive-reader';

// CommonJS
const { TwitterArchive } = require('twitter-archive-reader');
```

## Features

### For both classic and GDPR archives

- Access tweets using date selectors (by month, interval)
- Search in tweets with custom filters
- Get a single tweet by ID
- Access user data stored in archive, like screen name, name or profile picture
- Read both classic and full GDPR archive

### For GDPR archives

- Access direct messages with query selectors (conversation, date, content, context around one message)
- Access images linked to messages
- List of favorites, blocks, mutes, followers and followings
- Screen name history
- Twitter moments
- Subscribed and created lists

## Usage

This package is usable inside a browser or in Node.js, but be aware that loading a GDPR archive is very RAM-consuming, as the ZIP can exceed the gigabyte of data, so use this feature with care.

### Getting ready

Once you've created the instance, you must wait for the ready-ness status of the object with the `.ready()` promise.

Supported loading methods:
- `File` from browser
- `Buffer` or `ArrayBuffer`
- `string` (filename) for loading files in Node.js
- `number[]` or `Uint8Array`, bytes arrays
- `JSZip` instances
- `Archive` instances (see `StreamZip.ts/Archive` class)

```ts
// You can create TwitterArchive with all supported 
// formats by JSZip's loadAsync() method 
// (see https://stuk.github.io/jszip/documentation/api_jszip/load_async.html).
// You can also use filename or node Buffer.

// By a filename
const archive = new TwitterArchive('filename.zip');

// By a file input (File object)
const archive = new TwitterArchive(document.querySelector('input[type="file"]').files[0]);

// Initialization can be long (unzipping, tweets & DMs reading...) 
// So archive supports events, you can listen for initialization steps
archive.addEventListener('zipready', () => {
  // ZIP is unzipped
});
archive.addEventListener('tweetsread', () => {
  // Tweet files has been read
});
// See all available listeners in Events section.

console.log("Reading archive...");
// You must wait for ZIP reading and archive object build
await archive.ready();

// Archive is ready !
```

### Options for TwitterArchive
You can set options when you load the `TwitterArchive` instance.

Available options are:
```ts
new TwitterArchive(
  /** 
   * Archive to load.
   * Can be a string (filename), number[], Uint8Array,
   * JSZip, Archive, ArrayBuffer and File objects.
   */
  file: AcceptedZipSources,
  /** 
   * If the file is a modern/GDPR archive, TwitterArchive
   * will build the "extended" data. 
   */
  build_extended: boolean = true,
  /** 
   * After archive load, define if the dezipped archive 
   * should stay in memory. 
   * Setting this parameter to false could 
   * reduce memory consumption.
   * 
   * In specific circonstances, the archive will 
   * stay loaded even if this parameter is false.
   */
  keep_loaded: boolean = false,
  /**
   * In Twitter GDPR archives v2, tweet and dm images are in ZIP archives inside the ZIP.
   * If `true`, TwitterArchive will extract its content in RAM to allow the usage of images.
   * If `false`, DMs images will be unavailable.
   * If `undefined`, Twitter will extract in RAM in browser mode, and leave the ZIP untouched in Node.js.
   * 
   * You still have the possibility to load these archive using `.importDmImageZip()` (custom ZIP).
   * 
   * If you want to load the DM image ZIP present in the archive when you want, use `.loadCurrentDmImageZip()`. 
   * **Please note that `keep_loaded` should be set to `true` to use this method !**
   */
  load_images_in_zip: boolean? = undefined
)
```

### Tweet access

Several methods exists for tweet access.
Remember that tweets are not sorted when you access them.

Tweets are returned usally in a `PartialTweet[]`. You can check defined properties in `TwitterTypes(.d).ts` file built-in the module.

- `.all` getter, which returns to you all existing tweets in the archive


```ts
// List the 30 first tweets in the archive
archive.all.slice(0, 30)
```

- `.between(since: Date, until: Date)`

Find tweets between two dates.

```ts
// Get all the tweets sent between two dates
archive.between(new Date("2018-01-24"), new Date("2018-02-10"));
```

- `.month(month: string, year: string)`

Get all the tweets from one month.

```ts
// Get all the tweets sent in one month
archive.month("1", "2018");
```

- `.id(id: string)`

Return the tweet with ID `id`.

### Properties

- `.length`: Number of tweets in archive.
- `.owner`: User ID of the archive owner.
- `.owner_screen_name`: Screen name of the archive owner.
- `.generation_date`: Archive creation date.
- `.is_gdpr`: True if archive is a GDPR archive.
- `.index`: Raw access to archive information / index. See `ArchiveIndex` interface.

### GDPR archive specificities

Some properties are restricted for the GDPR archive.

- `.messages`: Access to the `DMArchive` instance.
- `.extended_gdpr`: Access to GDPR's extended data (favorites, blocks...)

Specific methods:
- `.dmImage(name: string, is_group: boolean, as_array_buffer: boolean)`: Extract direct message file from its name (returns a `Promise<Blob | ArrayBuffer>`).
- `.dmImageFromUrl(url: string, is_group: boolean, as_array_buffer: boolean)`: Extract direct message file from the Twitter media URL contained in `DirectMessage` object (returns a `Promise<Blob | ArrayBuffer>`).

### Search in tweets

A `TweetSearcher` instance is available to find tweets into `PartialTweet[]`.

See its own documentation.

```ts
import { TweetSearcher } from 'twitter-archive-reader';

TweetSearcher.search(archive.all, "My query");
```

### Direct messages browsing

Access to the `DMArchive` object with `.messages` accessor in `TwitterArchive` instance.

#### Explore direct message archive

The `DMArchive` object is a container for `Conversation`s objects.

Please note that every conversation may have one or more participants and the screen name of each participant is unknown. Conversation are only aware of Twitter's user identifiers.

- `DMArchive.all: Conversation[]`

Access to every conversation stored.

```ts
// List every conversation stored in archive
archive.messages.all
    .map(e => `Conversation #${e.id} between #${[...e.participants].join(', #')}`)
```

- `DMArchive.groups: Conversation[]`

Retrives the group conversations only.

- `DMArchive.directs: Conversation[]`

Retrives the directs (between less or equal than two users) conversations.

- `DMArchive.count: number`

Number of messages in this archive.

- `DMArchive.length: number`

Number of conversations in this archive.

#### Explore conversations

Once you've get a conversation with `DMArchive`, you have access to its messages.
Note that some filtering methods returns a `SubConversation` object, that expose the same public methods that `Conversation`.

`Conversation` give access to included some `LinkedDirectMessage`s, that hold the data of one message.

Specificity of `LinkedDirectMessage`s is that they keep a reference of the message before (in time relativity) and after them, in the `.previous` and `.next` properties.

- `Conversation.all: LinkedDirectMessage[]`

Basic access to every direct message stored in current `Conversation`.

- `Conversation.find(query: RegExp): SubConversation`

Find direct messages using a query. Return a filtered conversation.

```ts
// Search for messages having specific text (use a RegExp to validate)
conversation.find(/Hello !/i);
```

- `Conversation.month(month: string, year: string): SubConversation`

Get a subconversation containing all the messages of a specific month.

- `Conversation.sender(ids: string | string[]): SubConversation`

Find direct messages sender by a specific user ID. Return a filtered conversation.

- `Conversation.recipient(ids: string | string[]): SubConversation`

Find direct messages recieved by a specific user ID. Return a filtered conversation.

- `Conversation.between(since: Date, until: Date): SubConversation`

Find direct messages send between two dates. Return a filtered conversation.

```ts
// Search for messages sent in a specific date
conversation.between(new Date("2019-01-01"), new Date("2019-02-04"));
```

- `Conversation.around(id: string, context?: number)`

Find context around a direct message. Returns a object containing the n-before and the n-after messages asked with *context*.

```ts
conversation.around("19472928432");

=> {
  before: LinkedDirectMessage[],
  current: LinkedDirectMessage,
  after: LinkedDirectMessage[]
}
```

- Chaining

You can chain methods that returns `SubConversation` objects.

```ts
// Every truncature method [.find(), .between(), .month(), .sender(), .recipient()]
// returns a sub-object (SubConversation) that have his own index and own methods.
// This allow you to chain methods:
conversation
  .find(/Hello/i)
  .between(new Date("2019-01-01"), new Date("2019-02-01"))
  .recipient(["MY_USER_1", "MY_USER_2"]);
```

- `Conversation.index: ConversationIndex`

Get the conversation details, with messages sorted by year, month and day.

- `Conversation.length: number`

Number of messages in this conversation.

- `Conversation.participants: Set<string>`

User IDs of the participants of this conversation.

- `Conversation.is_group_conversation: boolean`

True if the conversation is a group conversation.

- `Conversation.first: LinkedDirectMessage`

First DM in the conversation.

- `Conversation.last: LinkedDirectMessage`

Last DM in the conversation.


#### Explore images
Media loading methods are available on the `TwitterArchive` instance.

You can load with the image name (`'xi9309239xx-91.jpg'` for example), or directly from a URL 
(present in the `mediaUrls` property of a DM).

The two methods take the name or URL in first argument, 
a boolean indicating if the image should be found in the group DM archive or not, 
and a final argument (boolean) if the function should return an `ArrayBuffer` instead of a `Blob`.

**Please note that, in Node.js, the third argument should be always set to `true`, due to the unavailability of the `Blob` in this platform**.

- `.dmImage`: Get a image from a image name. 
- `.dmImageFromUrl`: Get a image from a media URL.

```ts
/* Browser */
// Get the image
const blob = await archive.dmImage("991765544733937669-512rVee-.jpg") as Blob;

// Create a URL and set it as img
const url = URL.createObjectURL(blob);
document.querySelector('img').src = url;

/* Node.js */
// Get the image
const array_buffer = await archive.dmImage("991765544733937669-512rdee-.jpg", false, true) as ArrayBuffer;
// Write the file to disk
fs.writeFileSync('test_dir/my_img.jpg', Buffer.from(blob));
```


#### Extended data
GDPR archives provide other data than tweets or direct messages.

Extended data is available under the `.extended_gdpr` property on `TwitterArchive` instance.

Please note that, during object construction, you should set the `build_extended` parameter to `true` (default), and the `.is_gdpr` property must be `true` in order to have this property set.

Available properties on this object are:
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

## Events

Archive is quite long to read: You have to unzip, read tweets, read user informations, direct messages, and some other informations...
So you might want to display current loading step to the end-user.

The `TwitterArchive` provides a event system compatible with Node.js and classic browser JS.

You could listen to events with `.addEventListener()` method or `.on**event_name**` attributes, like DOM elements.

Events are listed in their order of apparition.

Any of the described events, except `error`, contain elements in it (in `detail` attribute).

#### zipready

Fires when archive is unzipped (its content has not been read yet !).

#### userinfosready

Fires when basic user informations (archive creation date, user details) **has been read**.


#### indexready

Fires when tweet index (months, tweet number) **has been read**.

#### tweetsread

Fires when tweet files **has been read**.

#### willreaddm

Fires when direct messages files are **about to be read**.
*This event does not fire when a classic archive is given*.

#### willreadextended

Fires when misc infos (favorites, moments...) are **about to be read**.
*This event does not fire when a classic archive is given*.

#### ready

Fires when the reading process is over. 

Linked to `.ready()` promise (fulfilled).

#### error

Fires when read fails.
Contain, in the `detail` attribute, the throwed error.

Linked to `.ready()` promise (rejected).
