'use strict';

import {test} from 'ava';

import {BrowserPool} from '../browserPool';
import {Browser} from 'puppeteer';

test('after max use browser is disposed', async (t) => {
    const browserPool = new BrowserPool({
        browserMaxUse: 2,
        poolSettings: { // options for generic pool
            idleTimeoutMillis: 300000,
            max: 1,
            min: 1,
            testOnBorrow: true,
        },
        browserArgs: {args: ['--no-sandbox']}
    });
    const browser1 = await browserPool.acquire(async(browser: Browser) => browser);
    const browser2 = await browserPool.acquire(async(browser: Browser) => browser);
    // as max and min is 1 only one browser is maintained so bot returned browser are same instances
    t.true(browser1 === browser2);
    // as browserMaxUse is 2 after two use of browser new instance returned is different instance
    const browser3 = await browserPool.acquire(async(browser: Browser) => browser);

    t.true(browser1 !== browser3);
});

