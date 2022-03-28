import { memoryLogStore } from "../../logger";

export type MemoryLogItemDisplay = {
    timeHuman: string,
    module: string,
    text: string,
    dataStr: string,
}

export default {

    getAllLogs() {
        const levels = memoryLogStore.getLevels();

        const lines: { [level: string]: MemoryLogItemDisplay[] } = {};
        for (const level of Object.keys(levels))
            lines[level] = memoryLogStore.getMessages(level).map((message) => {
                return {
                    timeHuman: new Date(message.time).toLocaleString(),
                    module: message.module,
                    text: message.text,
                    dataStr: Object.keys(message.data).length ? JSON.stringify(message.data, null, 2) : '',
                }
            })

        return {
            levels,
            lines,
        }
    },

    removeAllLogs() {
        memoryLogStore.clear();
    },

    getUiNotification() {
        return memoryLogStore.getUiNotification();
    },
}
