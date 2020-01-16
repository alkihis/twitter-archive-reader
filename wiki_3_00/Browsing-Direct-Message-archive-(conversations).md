Here, you can learn how you can explore all the conversations stored in your archive.

**Important note**: Direct messages are only available on GDPR archives (`archive.is_gdpr === true`).

Access to the `DMArchive` object with `.messages` accessor in `TwitterArchive` instance.

The `DMArchive` object is a container for `Conversation`s objects.

Please note that every conversation may have one or more participants and the screen name of each participant is unknown. Conversation are only aware of Twitter's user identifiers.

Learn how to explore DMs in a `Conversation` object in [Browsing a single DM conversation](./Browsing-a-single-DM-conversation.md).

- `DMArchive.all: Conversation[]`

Access to every conversation stored.

```ts
// List every conversation stored in archive
archive.messages.all
    .map(e => `Conversation #${e.id} between #${[...e.participants].join(', #')}`)
```

- `DMArchive.groups: Conversation[]`

Retrives the group conversations only.

- `DMArchive.directs: Conversation[]`

Retrives the directs (between less or equal than two users) conversations.

- `DMArchive.count: number`

Number of messages in this archive.

- `DMArchive.length: number`

Number of conversations in this archive.

- `DMArchive.with(user_ids: string | string[]): Conversation[]`

Get conversations that include all the specified user ids.

- `DMArchive.dms: GlobalConversation`

Get a conversation who contains **every** message. This "breaks" the per-conversation based system of the DMs.

*Warning*: First access to this property cause the creation of the `GlobalConversation` instance, which need to index every message one by one, by ID and by date. This could be time-consuming **and** memory inefficient if the number of direct messages is very large, so please take care !

- `Symbol.iterator`

Instances of `DMArchive` are iterable.

```ts
for (const conversation of archive.messages) {
  // conversation is a Conversation instance
}
```

## Continue

Next part is [Browsing a single DM conversation](./Browsing-a-single-DM-conversation.md)

