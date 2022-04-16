import logger from './logger';
import { ResourceHandler } from './ResourceHandler';
import { IResourceOrigin } from './resourceOrigins/IResourceOrigin';
import { GitHubOrigin } from './resourceOrigins/GitHubOrigin';

const UPDATE_FREQUENCY_MIN = 1;

class ResourceOriginError extends Error { }

const log = logger.child({ module: 'ResourceOrigin' });

export class ResourceOriginHandler {
    private resourceHandler: ResourceHandler;
    private origin: IResourceOrigin;
    private timer: NodeJS.Timer;

    private tryParseConnectionString(originString: string): IResourceOrigin | undefined {
        return GitHubOrigin.tryParseConnectionString(originString) ||
            undefined;
    }

    constructor(resourceHandler: ResourceHandler, originString: string) {
        this.resourceHandler = resourceHandler;

        const origin = this.tryParseConnectionString(originString);
        if (!origin)
            throw new ResourceOriginError('Cannot parse resourceorigin string');

        try {
            this.origin = origin;
            void this.origin
                .start()
                .then(() => { this.onTimer() })

            this.timer = setInterval(() => { this.onTimer(); }, UPDATE_FREQUENCY_MIN * 60 * 1000);
        }
        catch (error) {
            throw new ResourceOriginError(`Cannot start resourceorigin: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }

    public stop(): void {
        clearInterval(this.timer);
    }

    private onTimer() {
        log.debug('Check origin change');
        void this.origin.checkNewData((data: string) => {
            try {
                const dataBuffer = Buffer.from(data);

                this.resourceHandler.checkYamlForAdapt(dataBuffer);
                this.resourceHandler.deleteAllResource();
                this.resourceHandler.adaptFromYaml(dataBuffer);
            }
            catch (error) {
                throw new ResourceOriginError(`Cannot download and adapt resourceorigin: ${error instanceof Error ? error.message : 'unknown error'}`);
            }
        });
    }
}