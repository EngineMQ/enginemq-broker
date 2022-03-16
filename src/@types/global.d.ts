import { ClientList } from "../lib/ClientList";
import { MessageHandler } from "../lib/MessageHandler";
import { IStorage } from "../lib/storage/IStorage";
import { TopicHandler } from "../lib/TopicHandler";

type Context = {
    ClientList: ClientList,
    MessageHandler: MessageHandler,
    Topics: TopicHandler,
    Storage: IStorage,
}

declare global {
    var Context: Context;
}

export { };
