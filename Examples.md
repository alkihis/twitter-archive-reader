# Examples of usage of `twitter-archive-reader`

Here's a list of examples of basic operations to do with `twitter-archive-reader` package.

The following examples presume Node.js is used, but are also applicable to browser-like environnements.

This **complete** the documentation associated with each part, 
this **isn't meant to be a comprehensive list of what the package can do !**

This `import` statement will be printed every time a new thing need to be imported.

## Initialization

### Read an archive from a .zip file
```ts
import TwitterArchive from "twitter-archive-reader";

const archive = new TwitterArchive('filename.zip');
// Wait for file read
await archive.ready();
```

### Read an archive from a File input
```ts
import TwitterArchive from "twitter-archive-reader";

const file_input = document.querySelector('input[type="file"]') as HTMLInputElement;
const archive = new TwitterArchive(file_input.files[0]);
// Wait for file read
await archive.ready();
```

## Tweets

### Get text from some tweets
```ts
const tweets = archive.tweets;

// Take the 30ths first tweets and get their text
tweets.all.slice(0, 30).map(t => t.text);
```

### Count the number of retweets in archive
```ts
archive.tweets.all.reduce((acc, val) => {
  if (val.retweeted_status) {
    // This a retweet, the property exists
    return acc + 1;
  }
  return acc;
}, 0);
```

### Check if a tweet has a video or a GIF attached to it and get its URL
```ts
import TwitterArchive, { PartialTweet } from 'twitter-archive-reader';

function getVideoUrlOfTweet(tweet: PartialTweet) {
  // This is for GDPR archives — classic archives does not 
  // contains .extended_entities, only .entities 
  // (that can't contain videos).
  if (tweet.extended_entities && tweet.extended_entities.media) {
    const video = tweet.extended_entities.media.find(v => v.video_info);
  
    if (video) {
      // This contains a video.
      // A video can contains multiple links: 
      // multiple formats/bitrate
  
      // We need to find the best bitrate for MP4 format
      // Then sort per bitrate, the higher the first
      const best_video = video.video_info.variants
        .filter(variant => variant.content_type === "video/mp4")
        .filter(variant => variant.bitrate)
        .sort((a, b) => Number(b.bitrate) - Number(a.bitrate));
  
      if (best_video.length) {
        const video_url = best_video[0].url;
  
        // Final step, trim the possible query string
        // at the end of the url...
        return video_url.split('?')[0];
      }
    }
  }

  return undefined;
}

// Execute the fn !
getVideoUrlOfTweet(archive.tweets.single('tweet_id'));
```


## Direct messages

### List all the direct message conversations available on the archive
```ts
const messages = archive.messages;

// We have only access to user IDs in DMs
const conversations = messages.all.map(c => 
  `Conversation #${c.id} with users #${[...c.participants].join(', #')}, 
   containing ${c.length} messages.`
);

console.log(...conversations);
```

### Count the number of sended direct messages (by archive owner)
```ts
archive.messages.all.reduce((acc, val) => 
  acc + val.all.filter(msg => msg.senderId === archive.user.id).length
, 0);

// or, for a less compact way
let count = 0;
for (const conversation of archive.messages) {
  for (const msg of conversation) {
    if (msg.senderId === archive.user.id) {
      count++;
    }
  }
}
```

### Check for presence of group conversations
```ts
if (archive.messages.groups.length) {
  console.log("This archive contains group conversations !");
}
```


## User-related data

### Show basic informations about archive owner, like screen name, name and bio
```ts
const user = archive.user;

console.log(`
  Screen name: ${user.screen_name},
  Name: ${user.name},
  Bio: ${user.bio},
  Registered location: ${user.location},
  User ID: ${user.id},
  You are${user.verified ? "" : " not"} verified.
`);
```

### Find account creation date and used IP
```ts
console.log(`
  Creation date: ${archive.user.created_at},
  Creation IP: ${archive.user.account_creation_ip}
`);
```

### List the used screen names (@) over time
```ts
const history = [
  ...archive.user.screen_name_history.map(s => s.changedFrom),
  archive.user.screen_name
];

console.log(`You used the following names: @${history.join(', @')}`);
```


## Ad-related data

## Find the most common advertisers the archive owner seen (90-day history)
```ts

```

## Group the advertise data by day of view
```ts

```


## Medias

## Get medias related to a direct message
```ts

```

## Get medias related to a tweet
```ts

```

## Get the user profile picture and banner as binary data
```ts

```