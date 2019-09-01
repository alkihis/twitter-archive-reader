import { DMFile } from './TwitterTypes'
import Conversation from "./Conversation";

export class DMArchive {
  protected index: {
    [convId: string]: Conversation
  } = {};

  constructor(protected me_id: string) { }

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
  }

  get(id: string) {
    return this.index[id];
  }

  has(id: string) {
    return id in this.index;
  }

  get all() {
    return Object.values(this.index);
  }

  /** Message count */
  get count() {
    let c = 0;
    for (const conv of this.all) {
      c += conv.length;
    }
    return c;
  }

  /** Conversation count */
  get length() {
    return this.all.length;
  }
}

export default DMArchive;
