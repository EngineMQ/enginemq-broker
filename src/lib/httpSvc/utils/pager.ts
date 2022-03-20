/* eslint-disable @typescript-eslint/no-magic-numbers */
export default (itemCount: number, pageSize: number, currentPage: number) => {
    const result: number[] = [];

    const maxPages = Math.ceil(itemCount / (pageSize || 1));

    const pages = [];
    pages.push(1);
    pages.push(maxPages);
    for (let cp = currentPage - 2; cp <= currentPage + 2; cp++)
        pages.push(cp);

    for (const p of pages)
        if (p >= 1 && p <= maxPages)
            if (!result.includes(p))
                result.push(p);

    result.sort((a, b) => a - b);
    return result;
}