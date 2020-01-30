This page suppose you already obtain a `Conversation` object, through the `DMArchive` instance (see [Browsing Direct Message archive](./Browsing-Direct-Message-archive-(conversations))).

`Conversation` object will be named, for convention, `conversation`.

Note that some filtering methods returns a `SubConversation` object, that expose the same public methods that `Conversation` (except conversation ID `.id`).

`Conversation` give access to included some `LinkedDirectMessage`, that hold the data of one message.
Detail of the interface is given at the end of this page.

- `Conversation.all: LinkedDirectMessage[]`

Basic access to every direct message stored in current `Conversation`.

- `Conversation.find(query: RegExp): SubConversation`

Find direct messages using a query. Return a filtered conversation.

```ts
// Search for messages having specific text (use a RegExp to validate)
conversation.find(/Hello !/i);
```

- `Conversation.month(month: string, year: string): SubConversation`

Get a subconversation containing all the messages of a specific month.

- `Conversation.sender(ids: string | string[]): SubConversation`

Find direct messages sender by a specific user ID. Return a filtered conversation.

- `Conversation.recipient(ids: string | string[]): SubConversation`

Find direct messages recieved by a specific user ID. Return a filtered conversation.

- `Conversation.between(since: Date, until: Date): SubConversation`

Find direct messages send between two dates. Return a filtered conversation.

```ts
// Search for messages sent in a specific date
conversation.between(new Date("2019-01-01"), new Date("2019-02-04"));
```

- `Conversation.around(id: string, context?: number)`

Find context around a direct message. Returns a object containing the n-before and the n-after messages asked with *context*.

```ts
conversation.around("19472928432");

=> {
  before: LinkedDirectMessage[],
  current: LinkedDirectMessage,
  after: LinkedDirectMessage[]
}
```

- `Symbol.iterator`

Instances of `Conversation` are iterable.

```ts
for (const message of conversation) {
  // message fulfill LinkedDirectMessage interface
}
```

- Chaining

You can chain methods that returns `SubConversation` objects.

```ts
// Every truncature method [.find(), .between(), .month(), .sender(), .recipient()]
// returns a sub-object (SubConversation) that have his own index and own methods.
// This allow you to chain methods:
conversation
  .find(/Hello/i)
  .between(new Date("2019-01-01"), new Date("2019-02-01"))
  .recipient(["MY_USER_1", "MY_USER_2"]);
```

- `Conversation.index: ConversationIndex`

Get the conversation details, with messages sorted by year, month and day.

- `Conversation.length: number`

Number of messages in this conversation.

- `Conversation.participants: Set<string>`

User IDs of the participants of this conversation.

- `Conversation.is_group_conversation: boolean`

True if the conversation is a group conversation.

- `Conversation.first: LinkedDirectMessage`

First DM in the conversation.

- `Conversation.last: LinkedDirectMessage`

Last DM in the conversation.


## Direct message data

Here's the properties available in a `DirectMessage`.
```ts
interface DirectMessage {
  /** Person who get the DM (Twitter user ID). */
  recipientId: string;
  /** Content of the DM. */
  text: string;
  /** 
   * Array of URLs linked to this direct message. 
   * Currently, a DM could only contain **one** media. 
   */
  mediaUrls: string[];
  /** Person who send the DM (Twitter user ID). */
  senderId: string;
  /** Message ID. */
  id: string;
  /** Stringified date of message creation. 
   * If the DM is a `LinkedDirectMessage`, 
   * please use **.createdAtDate** property to get the date,
   * it's already correctly parsed. 
   */
  createdAt: string;
}
```

Interface `LinkedDirectMessage`, that validate DMs in `Conversation` objects, add a `.previous` and `.next` property, linking the following and previous DM in the current conversation.

To get medias linked in one message, please see [Get a direct message media](./Get-a-direct-message-media).

## Continue

Next part is [Get a direct message media](./Get-a-direct-message-media)

