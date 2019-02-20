'use strict';

import {test} from 'ava';

import {BrowserPool} from '../browserPool';
import {Browser, LaunchOptions} from 'puppeteer';
import * as puppeteer from 'puppeteer';

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


test('number of browsers would not exceed max value', async (t) => {
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
    // console.log('browserPool.pool.size', browserPool.pool.size);
    let browserCount = 0;

    await browserPool.acquire(async() => {
        browserCount ++;

        const delay = new Promise(function(resolve) {
            setTimeout(function() {
                resolve();
            }, 1000);
        });
        await Promise.race([
            // because max is one and one browser is acquire next aquire would not be resolved because of browserMaxUse
            browserPool.acquire(async() => {browserCount++; }),
            delay
        ]);
        // await clearTimeout(timeoutId);
    });
    t.is(browserCount, 1);
});

test('acquired browser is not closed when testOnBorrow is true', async (t) => {
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

    let browser = await browserPool.acquire(async(browser: Browser) => browser);
    let pageReturned = await browser.newPage().catch(() => false);
    t.truthy(pageReturned);

    await browser.close();
    // @ts-ignore
    pageReturned = await browser.newPage().catch((error) => false);
    t.is(pageReturned, false);


    browser = await browserPool.acquire(async(browser: Browser) => browser);
    pageReturned = await browser.newPage().catch(() => false);
    t.truthy(pageReturned);
});

test('browser args are passed as launch options to puppeteer.launch', async (t) => {
    const originalFunction = puppeteer.launch;
    let launchOptionPassed: LaunchOptions|undefined;
    // @ts-ignore
    puppeteer.launch = async function(options: LaunchOptions) {
        launchOptionPassed = options;
        return await originalFunction.call(puppeteer, options);
    };
    new BrowserPool({
        browserMaxUse: 2,
        poolSettings: { // options for generic pool
            idleTimeoutMillis: 300000,
            max: 1,
            min: 1,
            testOnBorrow: true,
        },
        browserArgs: {args: ['--no-sandbox']}
    });
    t.deepEqual(launchOptionPassed, {args: ['--no-sandbox']});
});

