> A `TweetFinder` instance is available to find tweets into a `Iterable<PartialTweet>`.

## Select your finder

### Global

A global instance is exposed by the module, with the name `TweetSearcher`.

```ts
// TweetFinder instance is named TweetSearcher
import { TweetSearcher } from 'twitter-archive-reader';

// archive.tweets is iterable, so its ok
TweetSearcher.search(archive.tweets, "My query");
```

### For each tweet archive

Another `TweetFinder` instance is available in `archive.tweets.finder`.

In a tweet archive, you can find quickly in all tweets with `archive.tweets.find(query, is_regex, static_validators, search_in)`.
Parameters for this method are the same as the following, minus `tweets_array` (it in inferred to `archive.tweets.all`).

```ts
// Find directly in the archive
archive.tweets.find("My query");
```

## Simple usage

TweetSearcher is an instance with a main method search.
```ts
TweetSearcher.search(
  /* The tweets to search in (iterable, so array/generator/Set...) */
  tweets_array: Iterable<PartialTweet>,
  /* The query, in string format */
  query: string,
  /* 
    Indicate if the query will be converted in regex after validators has been trimmed. 
    If this parameter is a string, indicate the regex flags to set.
  */
  is_regex: boolean | string = false,
  /* Array of static validators names that should used. See `.static_validators`.
   * 
   * Default defined static validators are:
   * - `retweets_only`
   * - `medias_only`
   * - `videos_only`
   * - `no_retweets` 
   */
  static_validators: string[] = [],
  /* Tweet properties to search. This is NOT dynamic you can't specify the property you want.
   * Available properties are:
   * - `text`
   * - `user.screen_name`
   * - `user.name`
   */
  search_in: string[] = ["text", "user.screen_name"],
);
```
So, you can use it like this example:

```ts
// Search in all archive, a retweet containing a media, 
// which has a text including "Hello" (case insensitive).
TweetSearcher.search(
  archive.tweets,
  "Hello",
  "i",
  ["retweets_only", "medias_only"],
  ["text"]
);
```

## Advanced usage

First, you must know that TweetSearcher can enhance your search power with **validators**.

A validator can be **contextual** (> dependent of current search, it is defined inside {query} parameter) or **static** (> shared in all searches, chosen if it will be applied in the {static_validators} parameter).

You already know what's a static validator: we use it in the example before.

- `retweets_only` is a static validator (it check only if the tweet is a retweet, no context is required).

We now introduce **contextual** validators:
- `from:{username}` is a contextual validator (it check if `from:(\S+)` is defined in {query} parameter, and extract {username} from it).

### Define a custom static validator

Static validators are stored in the `TweetSearcher` instance, in the `static_validators` property.

`static_validators` is an object linking the static validator name to a `function`. This function must follow this prototype: `(tweet: PartialTweet) => boolean`. It will be executed for each searched tweet, and must return `true` or `false`, depending if the given tweet matches the validator.

For example, `retweets_only` validator could be defined as it follows:
```ts
function validateOnlyRetweets(tweet: PartialTweet): boolean {
  // Validator returns true only if property tweet.retweeted_status is defined
  return typeof tweet.retweeted_status !== "undefined";
}
```

Then, define your static validator into the `TweetSearcher.static_validators` property.

```ts
TweetSearcher.static_validators.retweets_only = validateOnlyRetweets;
```

> Note: To define validators on tweet archive's TweetFinder instance, use `archive.tweets.finder` instead of `TweetSearcher`.

You've done it!

### Define a custom contextual validator

Now, we will see how to define a *context-dependent* validator. This validator must "mutate" at each search, because it will depend of user-context.

A context dependent validator write as it follows, in the {query}: `{keyword}:{value}`. This meant to be used by end-user, in a text input for example (like the `from:{username}` of Twitter search).

For performance reason, we must not parse user query data at each call. Therefore, when {query} is read at the beginning of the `.search` method, `TweetSearcher` will find each **validator** the user have entered.

For each validator found, `TweetSearcher` will call a validator creator function stored in the `TweetSearcher.validators` property.
This function return a closure which validate the custom query entered by user.

It will be more clear with an example !

#### Building our contextual validator creator

Imagine we want to create a validator `since:YYYY-MM-DD` to check if a tweet is made after a user-defined date.

First, we create the validator creator function. 

This will return a closure, that take a tweet in parameter and return true if the tweet is made after user-defined date.
```ts
function checkIfTweetIsMadeAfterDate(user_query: string): ValidatorExecFunction {
  // {user_query} is the {value} after the two dots ":", in the query. 
  // Get the date entered by user (in ms, to compare)
  const time = new Date(user_query).getTime();

  // Check if date was valid
  if (isNaN(time)) {
    // We can return undefined if the query is unwell-formed. It will throw an Error.
    return undefined;
  }
  
  // The date is valid, we can create our closure
  function checkIfTweetIsValid(tweet: PartialTweet): boolean {
    return dateFromTweet(tweet).getTime() > time;
  }
  
  // Return it, it will be used for each tweet in the {tweets_array} !
  return checkIfTweetIsValid;
}
```

We now need to register our validator, in the property `.validators`.
```ts
// This is an array
TweetSearcher.validators.push({
  // Specify here the desired keyword
  keyword: 'since',
  // And here, the validator creator
  validator: checkIfTweetIsMadeAfterDate,
});
```

> Note: To define validators on tweet archive's TweetFinder instance, use `archive.tweets.finder` instead of `TweetSearcher`.

End-users can now use our custom validator is their queries !

**Warning**: This documentation is an example. There are already defined validators:
- `since:YYYY-MM-DD`
- `until:YYYY-MM-DD`
- `from:username`
- `retweets_of:username`

You don't need to re-define them.

## Continue

Next part is [Browsing Direct Message archive](./Browsing-Direct-Message-archive-(conversations))


