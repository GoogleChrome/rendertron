/*
 * Copyright 2018 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

import {test} from 'ava';
import * as Koa from 'koa';
import * as koaStatic from 'koa-static';
import * as path from 'path';

import {Renderer} from '../renderer';
import * as puppeteer from 'puppeteer';

const app = new Koa();
app.use(koaStatic(path.resolve(__dirname, '../../test-resources')));

const testBase = 'http://localhost:1234/';
const promiseTimeout = function(timeout: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });
};
/*
const config ={
    allowedRequestUrlsRegex: "^https?:\/\/(.*?).?gozefo.com.*",
    internalRequestCacheConfig: {
        cacheUrlRegex: "^https?:\/\/(img[0-9]{0,2}).?gozefo.com.*",
        imageCacheOptions: 'BLANK_PIXEL',
        cacheExpiry: 24 * 60 * 60 * 1000, // expiry for internal cache
    }
};
*/
test.before(async () => {
    await app.listen(1234);
});

test('rendering is not affected without cached config is not changed', async (t) => {
    const renderer = new Renderer(await puppeteer.launch({args: ['--no-sandbox']}));
    const res = await renderer.serialize(`${testBase}basic-script.html`, false);
    t.is(res.status, 200);
    t.true(res.content.indexOf('document-title') !== -1);
});


test('rendered content is same with cached config and without cached config is same', async (t) => {
    const rendererWithoutCache = new Renderer(await puppeteer.launch({args: ['--no-sandbox']}));
    const rendererWithCache = new Renderer(await puppeteer.launch({args: ['--no-sandbox']}), {
        internalRequestCacheConfig: {
            cacheUrlRegex: `^${testBase}basic-script.html`,
            imageCacheOptions: 'ALLOW',
            maxEntries: 2,
        }
    });
    const resWithoutCache = await rendererWithoutCache.serialize(`${testBase}basic-script.html`, false);
    const resWithCache = await rendererWithCache.serialize(`${testBase}basic-script.html`, false);
    t.deepEqual(resWithoutCache, resWithCache);
});

test('url matching with cachUrlRegex would be cached', async (t) => {
    const rendererWithCache = new Renderer(await puppeteer.launch({args: ['--no-sandbox']}), {
        internalRequestCacheConfig: {
            cacheUrlRegex: `^.*.js$`,
            imageCacheOptions: 'ALLOW',
            maxEntries: 2,
        }
    });
    await rendererWithCache.serialize(`${testBase}script-after-load.html`, false);
    // @ts-ignore
    t.truthy(rendererWithCache.cacheStore.get(`${testBase}inject-element.js`));
});

test('cached response is expired after expiry given in config', async (t) => {
    const rendererWithCache = new Renderer(await puppeteer.launch({args: ['--no-sandbox']}), {
        internalRequestCacheConfig: {
            cacheUrlRegex: `^.*.js$`,
            imageCacheOptions: 'ALLOW',
            cacheExpiry: 3000, // expiry for internal cache
            maxEntries: 2,
        }
    });
    await rendererWithCache.serialize(`${testBase}script-after-load.html`, false);
    // @ts-ignore
    t.truthy(rendererWithCache.cacheStore.get(`${testBase}inject-element.js`));
    await promiseTimeout(3001).then(() => {
        // @ts-ignore
        t.is(rendererWithCache.cacheStore.get(`${testBase}inject-element.js`), undefined);
    });
});

test('first set cached response is removed if not used when maxEntries is breached', async (t) => {
    const rendererWithCache = new Renderer(await puppeteer.launch({args: ['--no-sandbox']}), {
        internalRequestCacheConfig: {
            cacheUrlRegex: `.*`,
            imageCacheOptions: 'ALLOW',
            maxEntries: 1,
        }
    });
    await rendererWithCache.serialize(`${testBase}basic-script.html`, false);
    // @ts-ignore
    t.truthy(rendererWithCache.cacheStore.get(`${testBase}basic-script.html`));

    await rendererWithCache.serialize(`${testBase}script-after-load.html`, false);
    // @ts-ignore
    t.is(rendererWithCache.cacheStore.get(`${testBase}basic-script.html`, undefined));
});

test('second set cached response is removed if first set response is used after second is set (verify lru logic)', async (t) => {
    const rendererWithCache = new Renderer(await puppeteer.launch({args: ['--no-sandbox']}), {
        internalRequestCacheConfig: {
            cacheUrlRegex: `.*`,
            imageCacheOptions: 'ALLOW',
            maxEntries: 2,
        }
    });
    await rendererWithCache.serialize(`${testBase}basic-script.html`, false);
    await rendererWithCache.serialize(`${testBase}basic-script.html?call=2`, false);
    // await rendererWithCache.serialize(`${testBase}basic-script.html`, false);


    await rendererWithCache.serialize(`${testBase}basic-script.html`, false);

    await rendererWithCache.serialize(`${testBase}basic-script.html?call=3`, false);

    // @ts-ignore
    t.is(rendererWithCache.cacheStore.get(`${testBase}basic-script.html?call=2`, undefined));
    // @ts-ignore
    t.truthy(rendererWithCache.cacheStore.get(`${testBase}basic-script.html`));
});
