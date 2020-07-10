Tweet access is made with the `TwitterArchive` instance methods and properties.

## Access

Several methods exists for tweet access.
Remember that tweets are not sorted when you access them.

Tweets are returned usually in a `PartialTweet[]`. You can check defined properties in `TwitterTypes(.d).ts` file built-in the module.

- `.all` getter, which returns to you all existing tweets in the archive, in a classic array

```ts
// List the 30 first tweets in the archive
archive.all.slice(0, 30)
// The number of tweets in this archive
archive.all.length
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

- `.fromThatDay()`
Get the tweets made on the same day (& same month), but in all years.

```ts
// If we're the 3 Jan 2018, returns all tweets made the 3 Jan 2004-20xx
archive.fromThatDay();
```

- `.id(id: string)`

Return the tweet with ID `id`.

## Manipulation / helpers
Functions exported in the module, to help you for manipulating tweets. 

- `dateFromTweet(tweet: PartialTweet): Date`


- `isWithMedia(tweet: PartialTweet): boolean`


- `isWithVideo(tweet: PartialTweet): boolean`


## Continue

Next part is [Search into tweets](./Search-into-tweets.md). 

