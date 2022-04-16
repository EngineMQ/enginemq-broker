export type ResourceOriginNewDataCallback = (data: string) => void;

export interface IResourceOrigin {
    start(): Promise<void>;
    checkNewData(callback: ResourceOriginNewDataCallback): Promise<void>;
}
