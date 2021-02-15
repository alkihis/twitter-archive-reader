import Conversation from "../direct_messages/Conversation";

/*
 * Conversation & DM File
 */

export type DMFile = GDPRConversation[];

export interface GDPRConversation {
  dmConversation: {
    conversationId: string;
    messages: DirectMessageEventContainer[];
  }
}

export interface DirectMessageEventContainer {
  messageCreate?: DirectMessage;
  welcomeMessageCreate?: DirectMessage;
  joinConversation?: JoinConversation;
  conversationNameUpdate?: ConversationNameUpdate;
  participantsJoin?: ParticipantJoin;
  participantsLeave?: ParticipantLeave;
  reactionCreate?: MessageReaction;
}

/*
 * Storage of direct messages inside package
 */

export interface DirectMessageEventsContainer {
  joinConversation?: JoinConversation[];
  conversationNameUpdate?: ConversationNameUpdate[];
  participantsJoin?: ParticipantJoin[];
  participantsLeave?: ParticipantLeave[];
  reactionCreate?: MessageReaction[];
}

/*
 * Direct message
 */

export interface DirectMessageEvent {
  /** When this happends */
  createdAt: string;
  /** Set when date is parsed. This serves as a cache. */
  createdAtDate?: Date;
}

export interface DirectMessageUrl {
  /** Shortened URL. */
  url: string;
  /** Full, original URL. */
  expanded: string;
  /** URL that should be displayed in a HTML representation of the message. */
  display: string;
}

export interface DirectMessage extends DirectMessageEvent {
  /**
   * Person who get the DM (Twitter user ID).
   * In group conversations, this property isn't defined or is set to `"0"`.
   */
  recipientId: string;
  /** Content of the DM. */
  text: string;
  /** Message reactions. If message don't have reaction, this is `undefined` or empty array `[]`. */
  reactions?: MessageReaction[];
  /**
   * Array of URLs linked to this direct message.
   * Currently, a DM could only contain **one** media.
   *
   * To display images/medias linked in this property, use
   * **.dmImageFromUrl()** method in the `TwitterArchive` instance.
   */
  mediaUrls: string[];
  /** Person who send the DM (Twitter user ID). */
  senderId: string;
  /** Message ID. */
  id: string;
  /** URLs linked in the message text. This property might be `undefined` on archives before 2021. */
  urls?: DirectMessageUrl[];
}

export interface LinkedDirectMessage extends DirectMessage {
  /** Previous message in its conversation. `null` if this message is the first. */
  previous: LinkedDirectMessage | null;
  /** Next message in its conversation. `null` if this message is the last. */
  next: LinkedDirectMessage | null;
  createdAtDate: Date;
  /** Conversation linked to the message. This property is set if the message is in a `GlobalConversation` object. */
  conversation?: Conversation;
  /** Events fired before and after this direct message.
   * Events can be conversation name change, a new participant... */
  events?: {
    before?: DirectMessageEventsContainer;
    after?: DirectMessageEventsContainer;
  };
}

/*
 * Direct message events
 */

export type DirectMessageEventType = keyof DirectMessageEventContainer;

/** Event fired when someone invite people to a conversation */
export interface ParticipantJoin extends DirectMessageEvent {
  /** Which person (user ID) invited someone to the conversation */
  initiatingUserId: string;
  /** Concerned persons by this event */
  userIds: string[];
}

/** Event fired when someone leave conversation. */
export interface ParticipantLeave extends DirectMessageEvent {
  /** Concerned persons by this event */
  userIds: string[];
}

/** Event fired when you are invited inside a group conversation. */
export interface JoinConversation extends DirectMessageEvent {
  /** Which person (user ID) invited you to the conversation */
  initiatingUserId: string;
  /** Set of user IDs present in the conversation at the time of the event. */
  participantsSnapshot: string[];
}

/** Event fired when the name of the conversation changes. */
export interface ConversationNameUpdate extends DirectMessageEvent {
  /** Which person (user ID) changed conversation name */
  initiatingUserId: string;
  /** The new conversation name. */
  name: string;
}

export type ReactionKey = "agree" | "disagree" | "sad" | "funny" | "surprised" | "like" | "hot";

export interface MessageReaction extends DirectMessageEvent {
  /** User ID that send this reaction. */
  senderId: string;
  /**
   * Reaction type.
   * Each emoji is linked to a key.
   *
   * - agree: Thumbs up
   * - disagree: Thumbs down
   * - sad: Emoji with a tear
   * - funny: Crying laugh emoji
   * - surprised: Emoji surprised
   * - like: A heart
   */
  reactionKey: ReactionKey;
  /** To which direct message this reaction is linked to. */
  eventId: string;
}
