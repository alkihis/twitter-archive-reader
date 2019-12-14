import { DMFile } from './TwitterTypes'
import Conversation from "./Conversation";

/**
 * Hold all the direct messages contained in a Twitter GDPR archive.
 */
export class DMArchive {
  protected index: {
    [convId: string]: Conversation
  } = {};

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
  message(id: string) {
    for (const conv of this.all) {
      const msg = conv.single(id);
      if (msg) {
        return msg;
      }
    }

    return undefined;
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
    let c = 0;
    for (const conv of this.all) {
      c += conv.length;
    }
    return c;
  }

  /** Conversation count. */
  get length() {
    return this.all.length;
  }
}

export default DMArchive;
