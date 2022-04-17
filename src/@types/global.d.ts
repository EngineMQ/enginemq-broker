import { ClientList } from "../lib/ClientList";
import { MessageHandler } from "../lib/MessageHandler";
import { ResourceHandler } from "../lib/ResourceHandler";
import { ResourceOriginHandler } from "../lib/ResourceOriginHandler";
import { IStorage } from "../lib/storage/IStorage";
import { TopicHandler } from "../lib/TopicHandler";

type Context = {
    ClientList: ClientList,
    MessageHandler: MessageHandler,
    Topics: TopicHandler,
    Storage: IStorage,
    ResourceHandler: ResourceHandler,
    ResourceOriginHandler: ResourceOriginHandler | undefined,
}

declare global {
    var Context: Context;
}

export { };
