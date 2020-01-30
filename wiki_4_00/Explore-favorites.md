All favorites are accessible through `.favorites` property of a `TwitterArchive` instance.

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

This object is iterable, and iterate over all registred `PartialFavorite`.

## Continue

Next part is [Explore ad data](https://github.com/alkihis/twitter-archive-reader/wiki/Explore-ad-data)

