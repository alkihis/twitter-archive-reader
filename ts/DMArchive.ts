import { DMFile } from './TwitterTypes'
import Conversation, { GlobalConversation } from "./Conversation";

/**
 * Hold all the direct messages contained in a Twitter GDPR archive.
 */
export class DMArchive {
  protected index: {
    [convId: string]: Conversation
  } = {};
  protected all_messages: GlobalConversation | undefined;
  protected sorted_date: Conversation[];
  protected sorted_count: Conversation[];

  constructor(protected me_id: string) { }

  /** Add a direct message file in current conversation object. */
  add(convs: DMFile) {
    for (const conv of convs) {
      if (conv.dmConversation.messages.length) {
        if (this.has(conv.dmConversation.conversationId)) {
          const c = this.get(conv.dmConversation.conversationId);
          c.add(conv);
        }
        else {
          const tmp = new Conversation(conv, this.me_id);
          this.sorted_count = undefined;
          this.sorted_date = undefined;
          this.index[tmp.id] = tmp;
        }
      }
    }

    // Index all convs
    for (const conv of this.all) {
      conv.indexate();
    }
  }

  /** Get a conversation with specific ID. undefined if it does not exists. */
  get(id: string) {
    return this.index[id];
  }

  /** Test if archive has a conversation with ID {id} */
  has(id: string) {
    return id in this.index;
  }

  /**
   * Get a message by ID
   */
  single(id: string) {
    if (this.all_messages) {
      return this.all_messages.single(id);
    }

    for (const conv of this.all) {
      const msg = conv.single(id);
      if (msg) {
        return msg;
      }
    }

    return undefined;
  }

  /**
   * Get all conversations that have {user_id} in their participants.
   * 
   * @param user_id Specifing an array of user ids find conversations 
   * where **all** those users are participating.
   */
  with(user_id: string | string[]) {
    if (typeof user_id === 'string') {
      user_id = [user_id];
    }

    return this.all.filter(conv => (user_id as string[]).every(user => conv.participants.has(user)));
  }

  /**
   * Get a conversation who has all messages in it. 
   * 
   * Please note that this method is not recommanded (and time-consuming at initialization). 
   * Use the real conversations instead.
   * 
   * Use cases: Search text in all messages, in every conversation / 
   * Show messages in a timeline, without interest of who wrote it
   */
  get dms() {
    if (this.all_messages) {
      return this.all_messages;
    }

    return this.all_messages = new GlobalConversation(this.all);
  }

  /** Group conversations */
  get groups() {
    return this.all.filter(c => c.is_group_conversation);
  }

  /** Direct (two participants) conversations */
  get directs() {
    return this.all.filter(c => !c.is_group_conversation);
  }

  /** Array of conversations registered in this archive. */
  get all() {
    return Object.values(this.index);
  }

  /** Message count. */
  get count() {
    return this.all.reduce((acc, cur) => cur.length + acc, 0);
  }

  /** Conversation count. */
  get length() {
    return this.all.length;
  }

  /** All conversations sorted by last message sent date (descending). */
  get sorted_by_date() {
    if (this.sorted_date) {
      return this.sorted_date;
    }

    return this.sorted_date = this.all.sort((a, b) => {
      const last_a = a.last;
      const last_b = b.last;

      if (last_a && last_b) {
        return last_b.createdAtDate.getTime() - last_a.createdAtDate.getTime();
      }
      return 0;
    });
  }

  /** All conversations sorted by message count (descending). */
  get sorted_by_count() {
    if (this.sorted_count) {
      return this.sorted_count;
    }
    return this.sorted_count = this.all.sort((a, b) => b.length - a.length);
  }

  /** Iterates all over conversations. */
  *[Symbol.iterator]() {
    yield* this.all;
  }
}

export default DMArchive;
