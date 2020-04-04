
# Examples of usage of `twitter-archive-reader`

Here's a list of examples of basic operations to do with `twitter-archive-reader` package.

This **complete** the documentation associated with each part, 
this **isn't meant to be a comprehensive list of what the package can do !**

This `import` statement will be printed every time a new thing need to be imported.

## <a name='Tableofcontents'></a>Table of contents

<!-- vscode-markdown-toc -->
* [Initialization](#Initialization)
	* [Read an archive from a .zip file](#Readanarchivefroma.zipfile)
	* [Read an archive from a File input](#ReadanarchivefromaFileinput)
* [Tweets](#Tweets)
	* [Get text from some tweets](#Gettextfromsometweets)
	* [Count the number of retweets in archive](#Countthenumberofretweetsinarchive)
	* [Check if a tweet has a video or a GIF attached to it and get its URL](#CheckifatweethasavideooraGIFattachedtoitandgetitsURL)
* [Direct messages](#Directmessages)
	* [List all the direct message conversations available on the archive](#Listallthedirectmessageconversationsavailableonthearchive)
	* [Count the number of sended direct messages (by archive owner)](#Countthenumberofsendeddirectmessagesbyarchiveowner)
	* [Check for presence of group conversations](#Checkforpresenceofgroupconversations)
* [User-related data](#User-relateddata)
	* [Show basic informations about archive owner, like screen name, name and bio](#Showbasicinformationsaboutarchiveownerlikescreennamenameandbio)
	* [Find account creation date and used IP](#FindaccountcreationdateandusedIP)
	* [List the used screen names (@) over time](#Listtheusedscreennamesovertime)
* [Ad-related data](#Ad-relateddata)
	* [Find the most common advertisers the archive owner seen (90-day history)](#Findthemostcommonadvertisersthearchiveownerseen90-dayhistory)
	* [Group the advertise data by day of view](#Grouptheadvertisedatabydayofview)
* [Medias](#Medias)
	* [Get medias related to a direct message](#Getmediasrelatedtoadirectmessage)
	* [Get media related to a direct message, by a media URL](#GetmediarelatedtoadirectmessagebyamediaURL)
	* [Get medias related to a tweet](#Getmediasrelatedtoatweet)
	* [Get the user profile picture and banner as binary data](#Gettheuserprofilepictureandbannerasbinarydata)
	* [Get medias of tweets posted in a certain period of time and write them in a directory](#Getmediasoftweetspostedinacertainperiodoftimeandwritetheminadirectory)

<!-- vscode-markdown-toc-config
	numbering=false
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->

## <a name='Initialization'></a>Initialization

### <a name='Readanarchivefroma.zipfile'></a>Read an archive from a .zip file
```ts
import TwitterArchive from "twitter-archive-reader";

const archive = new TwitterArchive('filename.zip');
// Wait for file read
await archive.ready();
```

### <a name='ReadanarchivefromaFileinput'></a>Read an archive from a File input
```ts
import TwitterArchive from "twitter-archive-reader";

const file_input = document.querySelector('input[type="file"]') as HTMLInputElement;
const archive = new TwitterArchive(file_input.files[0]);
// Wait for file read
await archive.ready();
```

## <a name='Tweets'></a>Tweets

### <a name='Gettextfromsometweets'></a>Get text from some tweets
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

### <a name='Countthenumberofretweetsinarchive'></a>Count the number of retweets in archive
```ts
archive.tweets.all.reduce((acc, val) => {
  if (val.retweeted_status) {
    // This a retweet, the property exists
    return acc + 1;
  }
  return acc;
}, 0);
```

### <a name='CheckifatweethasavideooraGIFattachedtoitandgetitsURL'></a>Check if a tweet has a video or a GIF attached to it and get its URL
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


## <a name='Directmessages'></a>Direct messages

### <a name='Listallthedirectmessageconversationsavailableonthearchive'></a>List all the direct message conversations available on the archive
```ts
const messages = archive.messages;

// We have only access to user IDs in DMs
const conversations = messages.all.map(c => 
  `Conversation #${c.id} with users #${[...c.participants].join(', #')}, 
   containing ${c.length} messages.`
);

console.log(...conversations);
```

### <a name='Countthenumberofsendeddirectmessagesbyarchiveowner'></a>Count the number of sended direct messages (by archive owner)
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

### <a name='Checkforpresenceofgroupconversations'></a>Check for presence of group conversations
```ts
if (archive.messages.groups.length) {
  console.log("This archive contains group conversations !");
}
```


## <a name='User-relateddata'></a>User-related data

### <a name='Showbasicinformationsaboutarchiveownerlikescreennamenameandbio'></a>Show basic informations about archive owner, like screen name, name and bio
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

### <a name='FindaccountcreationdateandusedIP'></a>Find account creation date and used IP
```ts
console.log(`
  Creation date: ${archive.user.created_at},
  Creation IP: ${archive.user.account_creation_ip}
`);
```

### <a name='Listtheusedscreennamesovertime'></a>List the used screen names (@) over time
```ts
const history = [
  ...archive.user.screen_name_history.map(s => s.changedFrom),
  archive.user.screen_name
];

console.log(`You used the following names: @${history.join(', @')}`);
```


## <a name='Ad-relateddata'></a>Ad-related data

### <a name='Findthemostcommonadvertisersthearchiveownerseen90-dayhistory'></a>Find the most common advertisers the archive owner seen (90-day history)
```ts
const impressions = archive.ads.impressions_by_advertiser;

const five_most_common = Object.entries(impressions)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 5)
  .map(e => e[0].slice(1)); // Get the screen name and trim the @

console.log("Most common advertisers: ", five_most_common.join(', '));
```

### <a name='Grouptheadvertisedatabydayofview'></a>Group the advertise data by day of view
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


## <a name='Medias'></a>Medias

### <a name='Getmediasrelatedtoadirectmessage'></a>Get medias related to a direct message
```ts
const my_dm = archive.messages.single('dm_id');

const medias_of_dm = await archive.medias.ofDm(my_dm);
```

### <a name='GetmediarelatedtoadirectmessagebyamediaURL'></a>Get media related to a direct message, by a media URL
```ts
const my_dm = archive.messages.single('dm_id');

if (my_dm.mediaUrls.length) {
  const first_media = await archive.medias.fromDmMediaUrl(
    my_dm.mediaUrls[0], 
    false /* Is DM in a group conversation ? */
  );
}
```

### <a name='Getmediasrelatedtoatweet'></a>Get medias related to a tweet
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

### <a name='Gettheuserprofilepictureandbannerasbinarydata'></a>Get the user profile picture and banner as binary data
```ts
const [profile, header] = await Promise.all([
  archive.medias.getProfilePictureOf(archive.user),
  archive.medias.getProfileBannerOf(archive.user)
]);
```


### <a name='Getmediasoftweetspostedinacertainperiodoftimeandwritetheminadirectory'></a>Get medias of tweets posted in a certain period of time and write them in a directory
```ts
import { promises as FsPromise } from 'fs';

// Find the tweets
const tweets = archive.tweets.between("2019-01-01T12:01:00Z", "2019-06-06T16:32:45Z");

const destination = "/path/to/dir/";

for (const tweet of tweets) {
  // Get the medias of the tweets
  const medias: ArrayBuffer[] = await archive.medias.ofTweet(tweet);

  let i = 0;
  for (const media of medias) {
    // Write a media on the disk
    await FsPromise.writeFile(destination + `${tweet.id_str}-${i}`, Buffer.from(media));
    i++;
  }
}
```
