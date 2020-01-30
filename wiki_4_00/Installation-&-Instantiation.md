## Getting started

Install package using NPM or Yarn.

```bash
npm i twitter-archive-reader
```
or
```bash
yarn add twitter-archive-reader
```

This package internally use [JSZip](https://stuk.github.io/jszip/documentation) to read ZIP archives, you can load archives in this module the same way you load them in JSZip.

```ts
// ESModules
import TwitterArchive from 'twitter-archive-reader';

// CommonJS
const { TwitterArchive } = require('twitter-archive-reader');
```

## Usage

You can create an instance with several types of objects, all of them must reference an archive. 
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
archive.events.on('zipready', () => {
  // ZIP is unzipped
});
archive.events.on('tweetsread', () => {
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
   * 
   * If you want to build an archive instance **without** a file, you can pass `null` here.
   * You must then load parts of the archive with `.loadArchivePart()` or `.loadClassicArchivePart()` !
   */
  file: AcceptedZipSources,
  options: TwitterArchiveLoadOptions = {
    /**
     * In Twitter GDPR archives v2, tweet and dm images are in ZIP archives inside the ZIP.
     * If `true`, TwitterArchive will extract its content in RAM to allow the usage of images.
     * If `false`, DMs images will be unavailable.
     * If `undefined`, Twitter will extract in RAM in browser mode, and leave the ZIP untouched in Node.js.
     * 
     * If you want to load the DM image ZIP present in the archive when you want, 
     * use `.loadArchivePart({ current_dm_images: true })`. 
     * **Please note that `keep_loaded` should be set to `true` to use this method !**
     */
    load_images_in_zip: boolean? = undefined,
    /**
     * Indicate if you want to parse ad data at build time (default=false).
     * 
     * If you want to differate, you can load ad data later with `.loadArchivePart({ current_ad_archive: true })`.
     */
    build_ad_archive?: boolean = false
  }
)
```

### Events

Archive is quite long to read: You have to unzip, read tweets, read user informations, direct messages, and some other informations...
So you might want to display current loading step to the end-user.

The `TwitterArchive` provides a event system compatible driven by the `events` package (native Node.js events).
The event emitter is available at the `.events` property of the `TwitterArchive` object.

You could listen to events with `.events.on()` method, and remove listener(s) with `.events.off()`.

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


## Continue

Next part is [Archive Properties](./Archive-properties). 
