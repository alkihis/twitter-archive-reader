import { supportsBigInt, dateOfDMEvent } from "../utils/helpers";
import bigInt from 'big-integer';
import { parseTwitterDate, getEventsFromMessages } from "../utils/exported_helpers";
import { LinkedDirectMessage, DirectMessageEventContainer, GDPRConversation, DirectMessageEventsContainer } from "../types/GDPRDMs";
import Settings from "../utils/Settings";

/** Register the number of messages in each year, month and day, and let you access those messages. */
interface ConversationIndex {
  count: number,
  years: {
    [year: string]: {
      count: number,
      months: {
        [months: string]: {
          count: number,
          days: {
            [day: string]: {
              count: number,
              messages: LinkedDirectMessage[]
            }
          }
        }
      }
    }
  }
}

interface DirectMessageIndex {
  [id: string]: LinkedDirectMessage
}

interface DirectMessageDateIndex {
  [year: string]: {
    [month: string]: {
      [day: string]: DirectMessageIndex
    }
  }
}

interface ConversationInfo {
  participants: Set<string>;
  me: string;
}

interface FullConversationInfo extends ConversationInfo {
  id: string;
}

abstract class ConversationBase {
  /** Handle infomations of this conversation like owner and participants. */
  protected info: ConversationInfo;
  protected _length: number;

  protected _index: DirectMessageIndex = {};
  protected _index_by_date: DirectMessageDateIndex;
  protected _all: LinkedDirectMessage[];

  protected register(msg: LinkedDirectMessage) {
    this._index[msg.id] = msg;
    if (!msg.createdAtDate) {
      msg.createdAtDate = parseTwitterDate(msg.createdAt);
    }
    this._length = undefined;
    this._all = undefined;
    this._index_by_date = undefined;
  }

  protected unregisterAll() {
    this._index = {},
    this._index_by_date = undefined;
    this._all = undefined;
    this._length = undefined;
  }

  /** Get direct messages from a specific month. */
  month(month: string | number, year: string | number) : SubConversation {
    const index = this.index_by_date;
    if (year in index && month in index[year]) {
      const messages = [].concat(...Object.values(index[year][month]).map(e => Object.values(e)));
      
      return new SubConversation(messages, this.info.me);
    }

    return new SubConversation([], this.info.me);
  }

  /** Find direct messages that matches a query on their text. */
  find(query: RegExp) {
    return new SubConversation(this.all.filter(e => query.test(e.text)), this.info.me);
  }

  /** Find context around a single direct message. */
  around(id: string, context: number = 20) {
    if (id in this._index) {
      const before: LinkedDirectMessage[] = [];
      const after: LinkedDirectMessage[] = [];
      const current = this._index[id];

      // Récupération des msg le précédant
      let current_observed_msg = current.previous;
      for (let i = 0; i < context && current_observed_msg !== null; i++) {
        before.push(current_observed_msg);
        current_observed_msg = current_observed_msg.previous;
        i++;
      }

      // Flip in order to have the older messages being on top.
      before.reverse();

      // Récupération des messages le suivant
      current_observed_msg = current.next;
      for (let i = 0; i < context && current_observed_msg !== null; i++) {
        after.push(current_observed_msg);
        current_observed_msg = current_observed_msg.next;
        i++;
      }

      return {
        before,
        current,
        after
      };
    }

    return undefined;
  }

  /** Get all messages recived or sended by a specific user (by ID) */
  from(id: string): SubConversation;
  /** Get all messages recived or sended by a pool of users (by ID) */
  from(ids: Iterable<string>): SubConversation;
  from(ids: string | Iterable<string>) {
    if (typeof ids === 'string') {
      ids = new Set([ids]);
    }
    if (!(ids instanceof Set)) {
      ids = new Set(ids);
    }

    return new SubConversation(
      this.all.filter(m => (ids as Set<string>).has(m.senderId) || (ids as Set<string>).has(m.recipientId)), 
      this.info.me
    );
  }

  /** Get all messages sended by a specific user (by ID) */
  sender(id: string): SubConversation;
  /** Get all messages sended by a pool of users (by ID) */
  sender(ids: Iterable<string>): SubConversation;
  sender(ids: string | Iterable<string>) {
    if (typeof ids === 'string') {
      ids = new Set([ids]);
    }
    if (!(ids instanceof Set)) {
      ids = new Set(ids);
    }

    return new SubConversation(this.all.filter(m => (ids as Set<string>).has(m.senderId)), this.info.me);
  }

  /** Get all messages received by a specific user (by ID) */
  recipient(id: string): SubConversation;
  /** Get all messages received by a pool of users (by ID) */
  recipient(ids: Iterable<string>): SubConversation;
  recipient(ids: string | Iterable<string>) {
    if (typeof ids === 'string') {
      ids = new Set([ids]);
    }
    if (!(ids instanceof Set)) {
      ids = new Set(ids);
    }

    return new SubConversation(this.all.filter(m => (ids as Set<string>).has(m.recipientId)), this.info.me);
  }

  /** Get all the direct messages between two dates. */
  between(since: Date, until: Date): SubConversation;
  /** Get all the direct messages between two specific messages (ids). */
  between(since_id: string, until_id: string): SubConversation;
  between<T = string | Date>(since: T, until: T) {
    if (typeof since === 'string' && typeof until === 'string') {
      return this.betweenIds(since, until);
    }
    if (since instanceof Date && until instanceof Date) {
      until.setDate(until.getDate() + 1);
  
      const since_time = since.getTime();
      const until_time = until.getTime();
  
      const valids: LinkedDirectMessage[] = [];
  
      for (const dm of this) {
        if (dm.createdAtDate.getTime() >= since_time && dm.createdAtDate.getTime() <= until_time) {
          valids.push(dm);
        }
      }
  
      return new SubConversation(valids, this.info.me);
    }

    throw new Error("since and until must both be strings, or both be Date objects.");
  }

  protected betweenIds(id1: string, id2: string) {
    if (supportsBigInt()) {
      if (BigInt(id1) > BigInt(id2)) {
        const tmp = id2;
        id2 = id1;
        id1 = tmp;
      }
    }
    else {
      if (bigInt(id1).lesser(bigInt(id2))) {
        const tmp = id2;
        id2 = id1;
        id1 = tmp;
      }
    }

    let current = this.single(id1);
    const return_value: LinkedDirectMessage[] = [];

    while (current !== null && current.id !== id2) {
      return_value.push(current);
      current = current.next;
    }

    return new SubConversation(return_value, this.info.me);
  }

  /** Retreives a single message (undefined if message does not exists). */
  single(id: string) {
    return this._index[id];
  }

  /** Check if message {id} exists in this conversation. */
  has(id: string) {
    return id in this._index;
  }

  /** 
   * Get conversation from a specific day (default to current day) 
   * 
   * @param day The day to search in. Can be a `Date` or a `string`-ified date.
   * If this param is not specified, {day} will be coerced to today.
   */
  day(day?: Date | string) {
    if (!day) {
      day = new Date;
    }
    else if (typeof day === 'string') {
      day = new Date(day);
    }

    const year = day.getFullYear(), month = day.getMonth() + 1, date = day.getDate();

    const index = this.index_by_date;
    if (year in index) {
      if (month in index[year]) {
        if (date in index[year][month]) {
          return new SubConversation(Object.values(index[year][month][date]), this.info.me);
        }
      }
    }

    return new SubConversation([], this.info.me);
  }

  /** 
   * Get conversation of the same day as {day}, but also in previous years. 
   * 
   * {day} can be omitted (refers to today), be a `Date` object, or be a `string`-ified date.
   */
  fromThatDay(day?: Date | string) {
    if (!day) {
      day = new Date;
    }
    else if (typeof day === 'string') {
      day = new Date(day);
    }

    const month = day.getMonth() + 1, date = day.getDate();

    const messages: LinkedDirectMessage[] = [];

    const index = this.index_by_date;
    for (const year in index) {
      if (month in index[year]) {
        if (date in index[year][month]) {
          messages.push(...Object.values(index[year][month][date]));
        }
      }
    }

    return new SubConversation(messages, this.info.me);
  } 

  /** Iterates all over the direct messages stored in this conversation. */
  *[Symbol.iterator]() {
    yield* this.all;
  }

  /** Participants IDs */
  get participants() : Set<string> {
    return this.info.participants;
  }

  /** 
   * Participants IDs, but without yourself. 
   * If <return_value>.size > 1, conversation is a group conversation 
   */
  get real_participants() : Set<string> {
    const tmp = new Set(this.info.participants);
    tmp.delete(this.info.me);

    return tmp;
  }

  /** True if this conversation is a group conversation. */
  get is_group_conversation() {
    return this.info.participants.size > 2;
  }

  /** All the messages in this conversation */
  get all() : LinkedDirectMessage[] {
    if (Settings.ENABLE_CACHE) {
      if (this._all)
        return this._all;
      return this._all = Object.values(this._index);
    }
    return Object.values(this._index);
  }

  /** Count of total messages, messages per year, month, day, plus the messages themselves. */
  get index() : ConversationIndex {
    // Total count
    const info: ConversationIndex = {
      count: 0,
      years: {}
    };

    // Count for each year separatly
    for (const [year, y_msgs] of Object.entries(this.index_by_date)) {
      info.years[year] = {
        count: 0,
        months: {}
      };

      // Count for each month separatly
      for (const [month, m_msgs] of Object.entries(y_msgs)) {
        info.years[year].months[month] = {
          count: 0,
          days: {}
        };

        // Count for each day separatly
        for (const [day, d_msgs] of Object.entries(m_msgs)) {
          const m = Object.values(d_msgs);
          info.years[year].months[month].days[day] = {
            count: m.length,
            messages: m
          };

          // Mise à jour compteurs intermédiaires
          info.count += m.length;
          info.years[year].count += m.length;
          info.years[year].months[month].count += m.length;
        }
      }
    }

    return info;
  }

  protected get index_by_date() : DirectMessageDateIndex {
    if (Settings.ENABLE_CACHE && this._index_by_date) {
      return this._index_by_date;
    }

    const index: DirectMessageDateIndex = {};

    for (const msg of this) {
      const [day, month, year] = [
        msg.createdAtDate.getDate(), 
        msg.createdAtDate.getMonth() + 1, 
        msg.createdAtDate.getFullYear()
      ];
  
      if (!index[year]) {
        index[year] = {};
      }
  
      if (!index[year][month]) {
        index[year][month] = {};
      }
  
      if (!index[year][month][day]) {
        index[year][month][day] = {};
      }
  
      index[year][month][day][msg.id] = msg;
    }

    if (Settings.ENABLE_CACHE) {
      return this._index_by_date = index;
    }
    return index;
  }

  /** Messages sorted by year, month and day, without any other informations */
  get raw_index() {
    return this.index_by_date;
  }

  /** Map message IDs to messages objets. */
  get id_index() {
    return this._index;
  }

  /** Number of messages in this conversation */
  get length() {
    if (this._length)
      return this._length;
    return this._length = this.all.length;
  }

  get infos() {
    return this.info;
  }

  /** First DM in this conversation. Access to next messages with LinkedDirectMessage.next */
  get first() {
    return this.all[0];
  }

  /** Last DM in this conversation. Access to previous messages with LinkedDirectMessage.previous */
  get last() {
    const all = this.all;

    return all[all.length - 1];
  }
  
  /** 
   * Get all the events related to this conversation, sorted by date, from oldest to newest. 
   * 
   * By default, this does not include messages, only other events, like conversation join or
   * name change.
   * 
   * To include messages, use `true` as first parameter.
   */
  *events(include_messages = false) {
    yield* getEventsFromMessages(this.all, include_messages);
  }
}

/**
 * Conversation between the owner of archive and one or more participants.
 */
export class Conversation extends ConversationBase {
  protected info: FullConversationInfo;
  protected unindexed: DirectMessageEventContainer[] = [];

  /** Quick access to first and last DMs */
  protected _first: LinkedDirectMessage = null;
  protected _last: LinkedDirectMessage = null;

  protected _names: string[] = [];

  /** 
   * Create a new Conversation instance, from raw GDPR conversation. 
   * Need self user_id to recognize which user is you.
   * 
   * Note that **.add()** is automatically call with the given conversation.
   */
  constructor(conv: GDPRConversation, me_id: string) {
    super();

    this.info = { id: conv.dmConversation.conversationId, me: me_id, participants: new Set };

    this.add(conv);
  }

  /** 
   * Add a new conversation part to actual conversation. 
   * Actual conversation and new part must have the same ID.
   * 
   * After you've imported all parts, you **must** call **.indexate()** to see messages !
   */
  add(conv: GDPRConversation) {
    if (conv.dmConversation.conversationId !== this.info.id) {
      throw new Error("You must add into a existing conversation a conversation with the same ID");
    }
    
    // Can't replace the array: conversations may be splitted into parts
    this.unindexed.push(...conv.dmConversation.messages);
  }

  /** `true` if a conversation is indexed. If `false`, a call to `.indexate()` is required. */
  get indexed() {
    return this.unindexed.length === 0;
  }

  /** 
   * Index imported messages. 
   * Needed to see all DMs. 
   * 
   * Should be call after you've imported all with **.add()**.
   */
  indexate() {
    const participants = new Set<string>();

    // Add every message and every event to "unindexed"
    const old_events: DirectMessageEventContainer[] = [];
    let first = true;

    function copyEveryEvent(events: DirectMessageEventsContainer) {
      if (!events)
        return;

      for (const [key, vals] of Object.entries(events)) {
        for (const val of vals) {
          old_events.push({ [key]: val });
        }
      }
    }

    for (const msg of this.all) {
      if (first) {
        // copy the previous events of the first message
        first = false;
        if (msg.events)
          copyEveryEvent(msg.events.before);
      }
      // after that, we copy only the after-events
      if (msg.events)
        copyEveryEvent(msg.events.after);

      delete msg.events;
      // Add the message to events
      old_events.push({ messageCreate: msg });
    }

    // Get all events, sorted by the OLDEST date the first. (asc order)
    // Because we want to explore messages from beginning to the end
    const events: DirectMessageEventContainer[] = this.unindexed
      .concat(old_events)
      .sort((a, b) => dateOfDMEvent(Object.values(a)[0]).getTime() - dateOfDMEvent(Object.values(b)[0]).getTime());

    // Every event is now sorted.

    this.unindexed = [];
    this.unregisterAll();

    // Indexation (ajout d'une clé next et previous)
    let previous_message: LinkedDirectMessage | null = null;

    if (events.length) {
      const first_event = events.find(e => e.messageCreate || e.welcomeMessageCreate);
      if (first_event) {
        this._first = Object.values(first_event)[0] as LinkedDirectMessage;
      }
    }

    /** Events registred between two direct messages read. */
    let previous_events: DirectMessageEventsContainer = undefined;

    for (const event of events) {
      if (event.messageCreate || event.welcomeMessageCreate) {
        // This is a msg, we register it !
        const actual_msg = (event.messageCreate || event.welcomeMessageCreate) as LinkedDirectMessage;
  
        if (!actual_msg.senderId)
          continue;
  
        actual_msg.previous = previous_message;
        actual_msg.next = null;
  
        if (previous_message) {
          previous_message.next = actual_msg;
        }
  
        previous_message = actual_msg;
  
        // Enregistrement participants
        if (actual_msg.recipientId && actual_msg.recipientId !== "0")
          participants.add(actual_msg.recipientId);
  
        participants.add(actual_msg.senderId);
  
        // Enregistrement dans l'index
        this.register(actual_msg);

        // If we already have events register before this message
        if (previous_events) {
          actual_msg.events = {
            before: previous_events
          };
          // We de-initialize events
          previous_events = undefined;
        }
      }
      else {
        // This is an event

        // We initialize event container if needed, 
        // otherwise we use current object.
        previous_events = previous_events || {};

        // We register the "next events" of the previous message if needed
        if (previous_message) {
          if (!previous_message.events) {
            previous_message.events = {};
          }
          if (!previous_message.events.after) {
            previous_message.events.after = previous_events;
          }
        }

        if (event.conversationNameUpdate) {
          if (previous_events.conversationNameUpdate) {
            previous_events.conversationNameUpdate.push(event.conversationNameUpdate);
          }
          else {
            previous_events.conversationNameUpdate = [event.conversationNameUpdate];
          }
          this._names.push(event.conversationNameUpdate.name);
        }
        else if (event.joinConversation) {
          if (previous_events.joinConversation) {
            previous_events.joinConversation.push(event.joinConversation);
          }
          else {
            previous_events.joinConversation = [event.joinConversation];
          }
        }
        else if (event.participantsJoin) {
          if (previous_events.participantsJoin) {
            previous_events.participantsJoin.push(event.participantsJoin);
          }
          else {
            previous_events.participantsJoin = [event.participantsJoin];
          }
        }
        else if (event.participantsLeave) {
          if (previous_events.participantsLeave) {
            previous_events.participantsLeave.push(event.participantsLeave);
          }
          else {
            previous_events.participantsLeave = [event.participantsLeave];
          }
        }
        else {
          console.log(event);
        }
      }
    }

    // EDGE CASE: If the conversation contains NO message, events will be inaccessible.

    // Registering participants
    this.info.participants = participants;
  }

  /** Conversation ID */
  get id() : string {
    return this.info.id;
  }

  get first() {
    return this._first;
  }

  get last() {
    if (!this._last) {
      const msg = this.all;
      this._last = msg[msg.length - 1];
    }

    return this._last;
  }

  /** Conversation custom name, if somebody has set it. Could be `undefined`. */
  get name() {
    if (!this._names.length)
      return undefined;
    return this._names[this._names.length - 1];
  }

  /** All the custom names given to this conversation. */
  get names() {
    return this._names;
  }
}

/**
 * A big conversation that contains every message.
 * 
 * Every message will be linked to its original conversation through the `.conversation` property.
 */
export class GlobalConversation extends ConversationBase {
  constructor(convs: Conversation[]) {
    super();

    const participants = new Set<string>();
    let me = "";
    if (convs.length) {
      me = convs[0].infos.me;
    }

    for (const conversation of convs) {
      for (const msg of conversation) {
        // Enregistrement participants
        if (msg.recipientId !== "0")
          participants.add(msg.recipientId);
  
        participants.add(msg.senderId);
  
        // Enregistrement dans l'index
        msg.conversation = conversation;
        this.register(msg);
      }
    }

    this.info = {
      participants,
      me
    };
  }
}

/** Part of a real conversation that have its own index and message count. */
export class SubConversation extends ConversationBase {
  constructor(messages: LinkedDirectMessage[], me_id: string) {
    super();

    const participants = new Set<string>();

    for (const actual_msg of messages) {
      // Enregistrement participants
      if (actual_msg.recipientId !== "0")
        participants.add(actual_msg.recipientId);

      participants.add(actual_msg.senderId);

      // Enregistrement dans l'index
      this.register(actual_msg);
    }

    // Enregistrement infos
    this.info = {
      participants,
      me: me_id
    };
  }
}

export default Conversation;
