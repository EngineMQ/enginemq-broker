import { ClientList } from "../lib/ClientList";
import { MessageHandler } from "../lib/MessageHandler";
import { ResourceHandler } from "../lib/ResourceHandler";
import { IStorage } from "../lib/storage/IStorage";
import { TopicHandler } from "../lib/TopicHandler";

type Context = {
    ClientList: ClientList,
    MessageHandler: MessageHandler,
    Topics: TopicHandler,
    Storage: IStorage,
    ResourceHandler: ResourceHandler,
}

declare global {
    var Context: Context;
}

export { };
