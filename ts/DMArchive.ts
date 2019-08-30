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
        const tmp = new Conversation(conv, this.me_id);
        this.index[tmp.id] = tmp;
      }
    }
  }

  get(id: string) {
    return this.index[id];
  }

  get all() {
    return Object.values(this.index);
  }
}

export default DMArchive;
