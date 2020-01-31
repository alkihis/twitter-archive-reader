# twitter-archive-reader

> Read data from classic Twitter archive and GDPR archive

This module helps to read data from Twitter archives.

## Features

### For all types of archives

- Access tweets using date selectors (by month, interval)
- Search in tweets with custom filters
- Get a single tweet by ID
- Access user data stored in archive, like screen name, name or profile picture

### For GDPR archives

- Access direct messages with query selectors (conversation, date, content, context around one message)
- Access images and videos stored in archive
- List of favorites, blocks, mutes, followers and followings
- Screen name history
- Lots of user-related data like interests, age information and email addresses
- Data from views and interactions with ads on Twitter website/mobile app
- Twitter moments
- Subscribed and created lists

[What's a GDPR archive ?](./wiki#different-kinds-of-archives)

## Usage

This package can be used inside a browser or in Node.js.

### Getting ready

Full documentation (version 5.x.x) is available on [GitHub Wiki](./wiki). Take a look !

### [Examples](./Examples.md)

You can find a bunch of usage examples in [this file](./Examples.md).

### Linking archive files to `twitter-archive-reader` objects and properties

You can find a [link between files and directories inside raw Twitter archives to this package data structures here](./Files_to_structures.md). This can help you if you've found a intersting property in some file and you want to explore it with `twitter-archive-reader` !

### Detailled type documentation

If you want to find a type definition quickly, or get a detailled view of a data structure, [a automatically-generated documentation is available here](https://alkihis.fr/twitter-archive-reader).

### About archive support

- **Classic archives** are supported in every version of this module
  - Since **1.0.0**:
    - Tweet read
    - Basic user info read
- **GDPR archives** basic support since 1.0.0:
  - Since **1.0.0**:
    - Tweet read
    - DM read
    - File size must be < 2 GB
  - Since **1.2.0**:
    - Favorites
    - Mutes
    - Blocks
  - Since **1.3.0**:
    - DM images
  - Since **1.4.1**:
    - Support DM images nested in ZIP files (GDPR archives 1.1)
  - Since **2.0.0**: 
    - GDPR archives are streamed: file size is no longer a limit.
    - Screen name history
  - Since **4.0.0**:
    - Extended favorites
    - Personalization data
    - Email addresses
    - Connected application
    - Many other user data
    - Ad data
  - Since **4.0.7**:
    - Support GDPR 1.2 archives (created since January 2020)
  - Since **5.0.0**:
    - Events in direct messages
    - Read every type of media available in GDPR archives


### Old documentation

Wiki for 2.x.x is available [here](./wiki_2_00/Home.md).

Wiki for 3.x.x is available [here](./wiki_3_00/Home.md).

Wiki for 4.x.x is available [here](./wiki_4_00/Home.md).

## Migrate from 2.x.x to 3.0.0

Migration guide is available [here](./wiki/Migrate-to-3.0.0).


## Migrate from 3.x.x to 4.0.0

Migration guide is available [here](./wiki/Migrate-to-4.0.0).

## Migrate from 4.0.x to 5.0.0

Migration guide is available [here](./wiki/Migrate-to-5.0.0).
