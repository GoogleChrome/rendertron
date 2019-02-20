'use strict';

import {test} from 'ava';

import BrowserWrapper from '../browserWrapper';
import * as puppeteer from 'puppeteer';

test('browserWrapper marks browser closed when browser disconnects', async (t) => {
    const browser = await puppeteer.launch({args: ['--no-sandbox']});
    const browserWrapper = new BrowserWrapper(browser);
    t.is(browserWrapper.ifClosed(), false);
    await browser.close();
    t.is(browserWrapper.ifClosed(), true);
});

test('browserWrapper increments the useCount for any get call', async (t) => {
    const browser = await puppeteer.launch({args: ['--no-sandbox']});
    const browserWrapper = new BrowserWrapper(browser);
    browserWrapper.getBrowser();
    t.is(browserWrapper.useCount, 1);
    browserWrapper.getBrowser();
    t.is(browserWrapper.useCount, 2);
});

test('browserWrapper close async function kills browser', async (t) => {
    const browser = await puppeteer.launch({args: ['--no-sandbox']});
    const browserWrapper = new BrowserWrapper(browser);
    let page = await browser.newPage().catch(() => false);
    t.truthy(page);
    await browserWrapper.close();
    page = await browser.newPage().catch(() => false);
    t.is(page, false);
});
