Tweet access is made with the `TweetArchive` instance methods and properties. It can be obtained by using `archive.tweets`, with `archive` a `TwitterArchive` instance.

We suppose now for the examples that `archive` is a `TwitterArchive` instance and `tweets` a `TweetArchive` instance.

## Access

Several methods exists for tweet access.
Remember that tweets are not sorted when you access them.

Tweets are returned usually in a `PartialTweet[]`. You can check defined properties in `TwitterTypes(.d).ts` file built-in the module.

- `.all` getter, which returns to you all existing tweets in the archive, in a classic array

```ts
// List the 30 first tweets in the archive
tweets.all.slice(0, 30)
// The number of tweets in this archive
tweets.length
```

- `Symbol.iterator`

`TweetArchive` instance is iterable.

```ts
for (const tweet of archive.tweets) {
  // tweet fulfill PartialTweet interface
}
```

- `.between(since: Date, until: Date)`

Find tweets between two dates.

```ts
// Get all the tweets sent between two dates
tweets.between(new Date("2018-01-24"), new Date("2018-02-10"));
```

- `.month(month: string, year: string)`

Get all the tweets from one month.

```ts
// Get all the tweets sent in one month
tweets.month("1", "2018");
```

- `.fromThatDay()`
Get the tweets made on the same day (& same month), but in all years.

```ts
// If we're the 3 Jan 2018, returns all tweets made the 3 Jan 2004-20xx
tweets.fromThatDay();
```

- `.single(id: string)`

Return the tweet with ID `id`.

- `.index`

Get the tweet index, by year then month, then tweet IDs.
Example:
```js
{
  // The year 2018
  2018: { 
    // The month of August
    8: { 
      // Tweets by IDs
      10284781739: <PartialTweet>,
      ...
    },
    ...
  },
  ...
}
``` 

- `.id_index`

Simple object associating `Tweet ID => PartialTweet` for all available tweets in the archive.

## Manipulation / helpers
Static methods inside of `TweetArchive` class, to help you for manipulating tweets. 

- `dateFromTweet(tweet: PartialTweet): Date`


- `isWithMedia(tweet: PartialTweet): boolean`


- `isWithVideo(tweet: PartialTweet): boolean`

- `sortTweets(tweets: PartialTweet[]): PartialTweet[]`: Sort tweets by IDs (so, by date, because IDs are timestamp indexes).


## Continue

Next part is [Search into tweets](https://github.com/alkihis/twitter-archive-reader/wiki/Search-into-tweets). 

