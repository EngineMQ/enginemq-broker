import { EOL } from 'node:os';
import * as v8 from 'node:v8';
import * as vm from 'node:vm';

export class MeasureTime {
    private start = Date.now();
    private measures = new Map<string, number>();

    public measure(name: string) {
        this.measures.set(name, Date.now() - this.start);
        this.start = Date.now();
    }

    public writeLog(callback: (values: string[]) => void) {
        const values: string[] = [];
        for (const [key, value] of this.measures.entries())
            values.push(`${key}=${value}ms`);
        callback(values);
    }
}

export const trimBoth = (string: string, chars: string) => {
    let start = 0;
    let end = string.length;

    while (start < end && chars.includes(string.charAt(start)))
        start++;

    while (end > start && chars.includes(string.charAt(end - 1)))
        end--;

    return start > 0 || end < string.length ? string.slice(start, end) : string;
}

export const trimStart = (string: string, chars: string) => {
    const end = string.length;
    let start = 0;

    while (start < end && chars.includes(string.charAt(start)))
        start++;

    return start > 0 ? string.slice(start, end) : string;
};

export const trimEnd = (string: string, chars: string) => {
    let end = string.length;

    while (end > 0 && chars.includes(string.charAt(end - 1)))
        end--;

    return end < string.length ? string.slice(0, end) : string;
};

export const prettyThousand = (value: number, maxlevel = Number.MAX_VALUE) => {
    if (value > 2 * 1000 * 1000 * 1000 && maxlevel > 2)
        return `${Math.round(value / 1000 / 1000 / 1000)}G`;
    if (value > 2 * 1000 * 1000 && maxlevel > 1)
        return `${Math.round(value / 1000 / 1000)}M`;
    if (value > 2 * 1000 && maxlevel > 0)
        return `${Math.round(value / 1000)}k`;
    return value;
}

export const yamlJoin = (yamls: string[]): string => {
    const yamlsTrimmed = yamls.map((y) => trimBoth(y, EOL));
    return yamlsTrimmed.join(EOL + EOL + '---' + EOL + EOL) + EOL;
}

export const yamlAdaptDateTimeHeader = (yaml: string): string => {
    if (!yaml)
        return yaml;
    return `# Exported at ${new Date().toISOString()}` + EOL + EOL + yaml;
}

export const reduceArrayIfOneItem = <T>(array: Array<T>): Array<T> | T => {
    if (array.length == 1 && array[0]) return array[0];
    return array;
}

export const shuffleArray = <T>(array: Array<T>) => {
    let currentIndex = array.length;

    while (currentIndex != 0) {
        const randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        const a = array[currentIndex];
        const b = array[randomIndex];
        if (a) array[randomIndex] = a;
        if (b) array[currentIndex] = b;
    }

    return array;
}

type IndexedObject = { [key: string]: any; };
export const trimStringFields = (object: IndexedObject) => {
    for (const fieldName of Object.keys(object)) {
        const field = object[fieldName];
        if (typeof field === 'string')
            object[fieldName] = field.trim();
        else if (typeof field === 'object')
            if (Array.isArray(field)) {
                const newArray: any[] = [];
                for (const arrayItem of field)
                    if (typeof arrayItem === 'string')
                        newArray.push(arrayItem.trim());
                    else if (typeof arrayItem === 'object' && !Array.isArray(arrayItem))
                        newArray.push(trimStringFields(arrayItem as IndexedObject));
                object[fieldName] = newArray;
            }
            else
                object[fieldName] = trimStringFields(field as IndexedObject);
    }
    return object;
}

export const topicStringToRegExpOrString = (topicstr: string): string | RegExp => {
    if (/^[\d#*.a-z]+$/i.test(topicstr) && (topicstr.includes('#') || topicstr.includes('*'))) {
        while (topicstr.includes('^')) topicstr = topicstr.replace('^', '')

        while (topicstr.includes('$')) topicstr = topicstr.replace('$', '')

        while (topicstr.includes('+')) topicstr = topicstr.replace('+', '')

        while (topicstr.includes('.')) topicstr = topicstr.replace('.', '\\_')
        while (topicstr.includes('_')) topicstr = topicstr.replace('_', '.')

        while (topicstr.includes('#')) topicstr = topicstr.replace('#', '[^.]+')

        while (topicstr.includes('*')) topicstr = topicstr.replace('*', '._')
        while (topicstr.includes('_')) topicstr = topicstr.replace('_', '*')

        return new RegExp('^' + topicstr + '$', 'i');
    }
    return topicstr;
}

v8.setFlagsFromString('--expose_gc');
export const gc = vm.runInNewContext('gc');

export const heapUsage = () => {
    const heapStat = v8.getHeapStatistics();
    return {
        size: heapStat.total_heap_size,
        used: heapStat.used_heap_size,
        limit: heapStat.heap_size_limit,
    }
}
