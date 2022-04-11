export interface IResource {
    get description(): string;

    getOptions(): object;
    setOptions(options: object): object;

    getYaml(resourceId: string): string;
}
