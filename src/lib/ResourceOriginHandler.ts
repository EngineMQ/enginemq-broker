import logger from './logger';
import { ResourceHandler } from './ResourceHandler';
import { IResourceOrigin, IResourceOriginLastStatus } from './resourceOrigins/IResourceOrigin';
import { GitHubOrigin } from './resourceOrigins/GitHubOrigin';

const UPDATE_FREQUENCY_MIN = 1;

class ResourceOriginError extends Error { }

const log = logger.child({ module: 'ResourceOrigin' });

export class ResourceOriginHandler {
    private resourceHandler: ResourceHandler;
    private origin: IResourceOrigin;
    private timer: NodeJS.Timer | undefined;

    private tryParseConnectionString(originString: string): IResourceOrigin | undefined {
        return GitHubOrigin.tryParseConnectionString(originString) ||
            undefined;
    }

    constructor(resourceHandler: ResourceHandler, originString: string) {
        this.resourceHandler = resourceHandler;

        const origin = this.tryParseConnectionString(originString);
        if (!origin)
            throw new ResourceOriginError('Cannot parse resourceorigin string');
        this.origin = origin;

    }

    public getLastStatus(): IResourceOriginLastStatus { return this.origin.getLastStatus(); }

    public async start(): Promise<void> {
        return this.origin
            .start()
            .then(async () => {
                await this.checkOriginForChanges();
                this.timer = setInterval(async () => { await this.checkOriginForChanges(); }, UPDATE_FREQUENCY_MIN * 60 * 1000);
            })
            .catch(error => {
                log.error(`Cannot start resourceorigin: ${error instanceof Error ? error.message : 'unknown error'}`);
            })
    }

    public stop(): void {
        if (this.timer)
            clearInterval(this.timer);
    }

    private async checkOriginForChanges(): Promise<void> {
        log.debug('Check origin change');
        await this.origin.checkNewData((data: string) => {
            try {
                const dataBuffer = Buffer.from(data);

                this.resourceHandler.checkYamlForAdapt(dataBuffer);
                this.resourceHandler.deleteAllResource();
                this.resourceHandler.adaptFromYaml(dataBuffer);
            }
            catch (error) {
                throw new ResourceOriginError(`Cannot download and adapt resourceorigin: ${error instanceof Error ? error.message : 'unknown error'}`);
            }
        }).catch(error => {
            log.error(`Cannot check resourceorigin: ${error instanceof Error ? error.message : 'unknown error'}`);
        });
    }
}