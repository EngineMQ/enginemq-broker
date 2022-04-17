export type ResourceOriginNewDataCallback = (data: string) => void;

export type IResourceOriginLastStatus = {
    description: string,
    isError: boolean,
    status: string,
    date: string,
}
export interface IResourceOrigin {
    start(): Promise<void>;
    checkNewData(callback: ResourceOriginNewDataCallback): Promise<void>;
    getLastStatus(): IResourceOriginLastStatus;
}
