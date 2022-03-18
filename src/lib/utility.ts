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

export const prettyThousand = (value: number) => {
    if (value > 2 * 1000 * 1000 * 1000)
        return `${Math.round(value / 1000 / 1000 / 1000)}G`;
    if (value > 2 * 1000 * 1000)
        return `${Math.round(value / 1000 / 1000)}M`;
    if (value > 2 * 1000)
        return `${Math.round(value / 1000)}k`;
    return value;
}
