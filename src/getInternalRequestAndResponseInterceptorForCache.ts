import InMemoryLRUCache from './InMemoryLRUCache';
import {RespondOptions, Request, Response} from 'puppeteer';
import * as fse from 'fs-extra';

export type ImageResponseOption =
    | 'BLANK_PIXEL'
    | 'IGNORE'
    | 'ALLOW';

export interface ResponseCacheConfig {
    cacheExpiry: number;
    cacheUrlRegex: RegExp;
    imageCacheOptions: ImageResponseOption;
}

export async function getInternalRequestAndResponseInterceptorForCache (config: ResponseCacheConfig) {
    const imageTypes = ['png', 'jpg', 'jpeg', 'gif', 'svg'];
    const imageRespondOptions = new Map<string, RespondOptions>();
    await Promise.all(imageTypes.map(async (extension) => {
        const imageBuffer: Buffer = await fse.readFile(`${__dirname}/../image-resources/blank.${extension}`);
        const respondOptions: RespondOptions = {
            contentType: `image/${extension}`,
            body: imageBuffer,
        };
        imageRespondOptions.set(extension, respondOptions);
    }));

    const cacheStore = new InMemoryLRUCache<RespondOptions>();

    async function internalRequestCacheInterceptor(interceptedRequest: Request) {
        const interceptedRequestFullUrl = interceptedRequest.url();
        const interceptedUrl = interceptedRequest.url().split('?')[0] || '';
        const extension = interceptedUrl.split('.').pop();
        if (extension && imageTypes.indexOf(extension) !== -1) {
            if (config.imageCacheOptions === 'BLANK_PIXEL') {
                const respondOptions: RespondOptions | undefined = imageRespondOptions.get(extension);
                if (respondOptions) {
                    await interceptedRequest.respond(respondOptions);
                } else {
                    await interceptedRequest.continue();
                }
            } else if (config.imageCacheOptions === 'IGNORE') {
                await interceptedRequest.abort();
            } else {
                await interceptedRequest.continue();
            }
        } else if (interceptedUrl.match(config.cacheUrlRegex)) {
            const cachedResponse = cacheStore.get(interceptedRequestFullUrl);
            if (cachedResponse) {
                await interceptedRequest.respond(cachedResponse);
            } else {
                await interceptedRequest.continue();
            }
        } else {
            await interceptedRequest.continue();
        }

    }

    async function internalResponseCacheInterceptor(response: Response) {
            if (response) {
                const url = response.url();
                const interceptedUrl = url.split('?')[0] || '';
                const extension = interceptedUrl.split('.').pop();
                if (interceptedUrl.match(config.cacheUrlRegex) && (!extension || imageTypes.indexOf(extension) === -1 || config.imageCacheOptions === 'ALLOW') && !cacheStore.get(url)) {
                    const headers = response.headers();
                    return await response.buffer().then((buffer: Buffer) => {
                        console.log('caching: ', response.url());
                        cacheStore.set(url, {
                            headers: headers,
                            contentType: headers && headers['content-type'] ? headers['content-type'] : 'text/html',
                            status: response.status(),
                            body: buffer,
                        }, config.cacheExpiry);
                    });
                }
            }
    }
    return {
        internalRequestCacheInterceptor,
        internalResponseCacheInterceptor,
    };
}
