# twitter-archive-reader

> Read data from classic Twitter archive and GDPR archive

This module helps to read data from Twitter archives.

## Introduction

### Different kinds of archives

It is important to know that Twitter has known different kind of archives. 

Initially, archives contains only tweets, with a simple HTML tweet viewer. Archives were quite light. Here, this kind of archive is named "Classic Archive"

In 2018, Twitter introduce a new way to get your data: the "GDPR Archive" (named like this because they've been developed to fulfill the new european law (data protection)). These archives contains a lot more: tweets, indeed, but also favorites, blocks, mutes, direct messages, and all the medias you've posted to Twitter. There is any viewer in those archives, so their exploration could be tough.

### About how the archives are treated in this module

This module is developed in mind to treat classic and GDPR archives the same way.

Tweets registered in GDPR archive are not well-formed: sometimes, long tweets (140+ characters)
are truncated (without possibility to read a longer version) and retweet data is not present.

Unobtainable data will be inferred from patterns (like tweets beginning with `RT @...` for retweets) in
order to convert them in a classic format.

Quoted tweet data are, for both types of archives, inexistant.

This module use **BigInt**, so at least **Node 10.4** or a **`BigInt` compatible browser** is *recommended*.

Module will use a fallback to `big-integer` npm module if `BigInt` does not exists.
**Please note that, for performance reasons, a `BigInt` compatible system is hugely recommended.**

## Table of contents

First, we will see how initialize the main class of the module, how to explore tweets in it, then we will explore direct messages.

1) [Installation & Instantiation](./Installation-&-Instantiation.md)
2) [Archive Properties](./Archive-properties.md)
3) [User data](./User-data.md)
4) Tweets
  - [Tweet access and manipulating tweets](./Tweet-access-and-manipulating-tweets.md)
  - [Search into tweets](./Search-into-tweets)
5) Direct Messages
  - [Browsing Direct Message archive](./Browsing-Direct-Message-archive-(conversations).md)
  - [Browsing a single DM conversation](./Browsing-a-single-DM-conversation.md)
  - [Get a direct message media](./Get-a-direct-message-media.md)
6) [Explore favorites](./Explore-favorites.md)
7) [Explore ad data](./Explore-ad-data.md)

