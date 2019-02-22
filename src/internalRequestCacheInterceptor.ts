import InMemoryLRUCache from './InMemoryLRUCache';
import {RespondOptions, Request} from 'puppeteer';
import * as fse from 'fs-extra';

export type ImageResponseOption =
    | 'BLANK_PIXEL'
    | 'IGNORE'
    | 'ALLOW';

export interface ResponseCacheConfig {
    cacheExpiry: number;
    cacheUrlRegex: string;
    imageCacheOptions: ImageResponseOption;
}

export async function getInternalRequestCacheInterceptor (config: ResponseCacheConfig) {
    const imageTypes = ['png', 'jpg', 'jpeg', 'gif', 'svg'];
    const imageRespondOptions = new Map<string, RespondOptions>();
    await Promise.all(imageTypes.map(async (extension) => {
        const imageBuffer: Buffer = await fse.readFile(`${__dirname}/resources/blank.${extension}`);
        const respondOptions: RespondOptions = {
            contentType: `image/${extension}`,
            body: imageBuffer,
        };
        imageRespondOptions.set(extension, respondOptions);
    }));

    const cacheStore = new InMemoryLRUCache<RespondOptions>();

    return function(interceptedRequest: Request) {
        const interceptedUrl = interceptedRequest.url().split('?')[0] || '';
        const extension = interceptedUrl.split('.').pop();
        if (extension && imageTypes.indexOf(extension) !== -1) {
            if (config.imageCacheOptions === 'BLANK_PIXEL') {
                const respondOptions: RespondOptions | undefined = imageRespondOptions.get(extension);
                if (respondOptions) {
                    return interceptedRequest.respond(respondOptions);
                } else {
                    return interceptedRequest.continue();
                }
            } else if (config.imageCacheOptions === 'IGNORE') {
                return interceptedRequest.abort();
            } else {
                return interceptedRequest.continue();
            }
        } else if (interceptedUrl.match(config.cacheUrlRegex)) {
            const cachedResponse = cacheStore.get(interceptedUrl);
            if (cachedResponse) {
                return interceptedRequest.respond(cachedResponse);
            } else {
                return interceptedRequest.continue().then(() => {
                    const response = interceptedRequest.response();
                    if (response) {
                        const headers = response.headers();
                        response.buffer().then((buffer: Buffer) => {
                            // console.log('caching: ', response.url());
                            cacheStore.set(interceptedUrl, {
                                headers: headers,
                                contentType: headers && headers['content-type'] ? headers['content-type'] : 'text/html',
                                // @ts-ignore
                                status: response.status(),
                                // @ts-ignore
                                body: buffer,
                            });
                        });
                    }
                });
            }
        } else {
            return interceptedRequest.continue();
        }

    };
}
