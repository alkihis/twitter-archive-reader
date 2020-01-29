# Examples of usage of `twitter-archive-reader`

Here's a list of examples of basic operations to do with `twitter-archive-reader` package.

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
const texts = tweets.all.slice(0, 30).map(t => t.text);

// Extract real text (without the starting(s) @)
texts.map(t => t.replace(/^(@\w+ ?)*/g, ''));
```

**Warning**:
To extract tweet text without leading mentions, do not use `.display_text_range`: In GDPR archives, this property is unproperly set and `.display_text_range[0]` is always `"0"`.
```ts
archive.tweets.all.find(t => t.display_text_range[0] !== "0") // => undefined
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
  acc + val.all.reduce((acc, val) => 
    acc + (val.senderId === archive.user.id ? 1 : 0)
  , 0)
, 0);

// or, in a less compact way
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
const impressions = archive.ads.impressions_by_advertiser;

const five_most_common = Object.entries(impressions)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 5)
  .map(e => e[0].slice(1)); // Get the screen name and trim the @

console.log("Most common advertisers: ", five_most_common.join(', '));
```

## Group the advertise data by day of view
```ts
import TwitterArchive, { AdImpression, TwitterHelpers } from 'twitter-archive-reader';

const days_to_impressions: { [day: string]: AdImpression[] } = {};

for (const impression of archive.ads.impressions) {
  const date = TwitterHelpers.parseAdDate(impression.impressionTime)

  const [day, month, year] = [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear(),
  ];

  const date_string = `${year}-${month}-${day}`;
  if (date_string in days_to_impressions) {
    days_to_impressions[date_string].push(impression);
  }
  else {
    days_to_impressions[date_string] = [impression];
  }
}
```


## Medias

## Get medias related to a direct message
```ts
const my_dm = archive.messages.single('dm_id');

const medias_of_dm = await archive.medias.ofDm(my_dm);
```

## Get media related to a direct message, by a media URL
```ts
const my_dm = archive.messages.single('dm_id');

if (my_dm.mediaUrls.length) {
  const first_media = await archive.medias.fromDmMediaUrl(
    my_dm.mediaUrls[0], 
    false /* Is DM in a group conversation ? */
  );
}
```

## Get medias related to a tweet
```ts
// Find a tweet with a media defined
const tweet = archive.tweets.all.find(t => t.extended_entities && t.extended_entities.media);

if (tweet) {
  // All medias of the tweet
  const medias = await archive.medias.ofTweet(tweet);

  // From a specific media
  const media_1 = tweet.extended_entities.media[0];
  const media_1_bin = await archive.medias.fromTweetMediaEntity(media_1);
}
```

## Get the user profile picture and banner as binary data
```ts
const [profile, header] = await Promise.all([
  archive.medias.getProfilePictureOf(archive.user),
  archive.medias.getProfileBannerOf(archive.user)
]);
```