import * as v8 from 'v8';
import * as vm from 'vm';

export class MeasureTime {
    private start = new Date().getTime();
    private measures = new Map<string, number>();

    public measure(name: string) {
        this.measures.set(name, new Date().getTime() - this.start);
        this.start = new Date().getTime();
    }

    public writeLog(cb: (values: string[]) => void) {
        const values: string[] = [];
        this.measures.forEach((value, key) => values.push(`${key}=${value}ms`));
        cb(values);
    }
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

export const reduceArrayIfOneItem = <T>(array: Array<T>): Array<T> | T => {
    if (array.length == 1)
        if (array[0])
            return array[0];
    return array;
}

export const prettyThousand = (value: number) => {
    if (value > 2 * 1000 * 1000 * 1000)
        return `${Math.round(value / 1000 / 1000 / 1000)}G`;
    if (value > 2 * 1000 * 1000)
        return `${Math.round(value / 1000 / 1000)}M`;
    if (value > 2 * 1000)
        return `${Math.round(value / 1000)}k`;
    return value;
}
type IndexedObject = { [key: string]: any; };
export const trimStringFields = (obj: IndexedObject) => {
    for (const fieldName of Object.keys(obj)) {
        const field = obj[fieldName];
        if (typeof field === 'string')
            obj[fieldName] = field.trim();
        else if (typeof field === 'object')
            if (Array.isArray(field)) {
                const newArray: any[] = [];
                for (const arrayItem of field)
                    if (typeof arrayItem === 'string')
                        newArray.push(arrayItem.trim());
                    else if (typeof arrayItem === 'object' && !Array.isArray(arrayItem))
                        newArray.push(trimStringFields(arrayItem as IndexedObject));
                obj[fieldName] = newArray;
            }
            else
                obj[fieldName] = trimStringFields(field as IndexedObject);
    }
    return obj;
}

export const topicStrToRegexpOrString = (topicstr: string): string | RegExp => {
    if (topicstr.match(/^[a-z0-9.*#]+$/i))
        if (topicstr.indexOf('#') >= 0 || topicstr.indexOf('*') >= 0) {
            while (topicstr.indexOf('^') >= 0) topicstr = topicstr.replace('^', '')

            while (topicstr.indexOf('$') >= 0) topicstr = topicstr.replace('$', '')

            while (topicstr.indexOf('+') >= 0) topicstr = topicstr.replace('+', '')

            while (topicstr.indexOf('.') >= 0) topicstr = topicstr.replace('.', '\\_')
            while (topicstr.indexOf('_') >= 0) topicstr = topicstr.replace('_', '.')

            while (topicstr.indexOf('#') >= 0) topicstr = topicstr.replace('#', '[^.]+')

            while (topicstr.indexOf('*') >= 0) topicstr = topicstr.replace('*', '._')
            while (topicstr.indexOf('_') >= 0) topicstr = topicstr.replace('_', '*')

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
