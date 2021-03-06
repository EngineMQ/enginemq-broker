import * as path from 'node:path';

import ignore from 'ignore';
import { fs } from 'memfs';
import * as git from 'isomorphic-git';
import * as http from 'isomorphic-git/http/node';

import logger from '../logger';
import * as config from '../../config';
import { IResourceOrigin, IResourceOriginLastStatus, ResourceOriginNewDataCallback } from './IResourceOrigin';
import { trimBoth, yamlJoin } from '../utility';

class ResourceGitHubOriginError extends Error { }

const log = logger.child({ module: 'ResourceOrigin' });
const memfsDirectory = '/';

let originStringMask = '^ github \\( repo = ([a-z0-9.\\-_/\\\\]*) (token = ([a-z0-9_]*))? (branch = ([a-z0-9.\\-_/]*))? (folder = ([a-z0-9.\\-_/]*))? \\) $';
while (originStringMask.includes(' '))
    originStringMask = originStringMask.replace(' ', '\\s*');

export class GitHubOrigin implements IResourceOrigin {
    private repository = '';
    private token = '';
    private branch = '';
    private folder = '';
    get maskedToken(): string {
        if (!this.token)
            return '';
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        return `${this.token.slice(0, 3)}...${this.token.slice(-3)}`;
    }
    private onAuth() {
        return { username: this.token }
    }

    private lastHead = '';
    private lastCommitStr = '';
    private lastStatusTime = 0;
    private lastErrorStr = '';

    private repoUrl() { return `https://github.com/${this.repository}`; }

    public static tryParseConnectionString(originString: string): GitHubOrigin | undefined {
        const originStringParsed = originString.match(new RegExp(originStringMask, 'i'));
        if (originStringParsed) {
            const result = new GitHubOrigin();
            result.repository = originStringParsed[1] as string;
            result.branch = originStringParsed
                .find(s => s && s.startsWith('branch='))
                ?.slice('branch='.length)
                || '';
            result.token = originStringParsed
                .find(s => s && s.startsWith('token='))
                ?.slice('token='.length)
                || '';
            result.folder = originStringParsed
                .find(s => s && s.startsWith('folder='))
                ?.slice('folder='.length)
                || '';
            result.folder = trimBoth(result.folder, '/');

            log.info({ repo: result.repository, token: result.maskedToken, branch: result.branch, folder: result.folder }, 'GitHUb resource origin initialized');
            return result;
        }
        return;
    }

    public getLastStatus(): IResourceOriginLastStatus {
        const descriptions = [];
        descriptions.push(`github://${this.repository}`);
        if (this.branch)
            descriptions.push(`:${this.branch}`);
        if (this.folder)
            descriptions.push(`/${this.folder}`);

        if (this.lastErrorStr.length > 0)
            return {
                description: descriptions.join(''),
                isError: true,
                status: this.lastErrorStr,
                date: 'occured at ' + new Date(this.lastStatusTime).toISOString(),
            }
        return {
            description: descriptions.join(''),
            isError: false,
            status: 'commit: ' + this.lastCommitStr,
            date: 'fetched at ' + new Date(this.lastStatusTime).toISOString(),
        }
    }

    public async start(): Promise<void> {
        return git.clone({
            fs,
            http,
            dir: memfsDirectory,
            url: this.repoUrl(),
            onAuth: () => { return { username: this.token } },
            ref: this.branch,
        })
            .then(() => { this.lastErrorStr = '' })
            .catch(error => {
                this.lastStatusTime = Date.now();
                this.lastErrorStr = `${error instanceof Error ? error.message : 'unknown error'} `;
                throw error;
            })
    }

    public async checkNewData(callback: ResourceOriginNewDataCallback): Promise<void> {
        log.debug('Fetch origin');
        try {
            const fetchResponse = await git.fetch({
                fs,
                http,
                dir: memfsDirectory,
                url: this.repoUrl(),
                onAuth: () => { return { username: this.token } },
                ref: this.branch,
            })
            if (fetchResponse.fetchHead && this.lastHead != fetchResponse.fetchHead) {
                this.lastHead = fetchResponse.fetchHead;

                const lastCommit = await git.readCommit({
                    fs,
                    dir: memfsDirectory,
                    oid: this.lastHead,
                });
                log.info({ head: this.lastHead, commit: lastCommit.commit.message.trim(), author: { name: lastCommit.commit.author.name, email: lastCommit.commit.author.email } }, 'New commit detected');

                this.lastCommitStr = `${lastCommit.commit.message.trim()} at ${new Date(lastCommit.commit.author.timestamp * 1000).toISOString()} by[${lastCommit.commit.author.name} /${lastCommit.commit.author.email}]`;
                this.lastStatusTime = Date.now();

                log.debug('Pull origin');
                await git.pull({
                    fs,
                    http,
                    dir: memfsDirectory,
                    url: this.repoUrl(),
                    onAuth: () => { return { username: this.token } },
                    ref: this.branch,
                    author: { name: config.serviceName },
                });

                const filesdata = await this.checkNewDataProcessFiles();
                callback(filesdata);
            }
            this.lastErrorStr = '';
        }
        catch (error) {
            this.lastErrorStr = `${error instanceof Error ? error.message : 'unknown error'}`;
            throw error;
        }
    }
    private async checkNewDataProcessFiles(): Promise<string> {
        let files = await git.listFiles({ fs, dir: memfsDirectory });

        if (this.folder)
            files = files.filter(f => f.startsWith(this.folder));

        const ignoreFileName = path.join(this.folder, '.yamlignore');
        if (files.includes(ignoreFileName)) {
            log.debug({ ignoreFileName }, 'Ignore file found');
            const ignoreContent = fs.readFileSync(path.join(memfsDirectory, ignoreFileName)).toString();
            const ignoreFilter = ignore().add(ignoreContent).createFilter();

            files = files.filter(file => ignoreFilter(file));
        }

        files = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
        if (files.length === 0)
            throw new ResourceGitHubOriginError('No yaml files found');

        log.debug({ files }, 'Origin files');

        return yamlJoin(files.map(file => fs.readFileSync(path.join(memfsDirectory, file)).toString()))
    }
}
