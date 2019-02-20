import * as puppeteer from 'puppeteer';
import BrowserWrapper from './browserWrapper';
import {LaunchOptions} from 'puppeteer';
import {Factory} from 'generic-pool';

/**
 * Factory for each resource in pool. This Factory provides method to create, destroy and validate each resource in pool
 */
export default class BrowserPoolFactory implements Factory<BrowserWrapper> {
    private readonly puppeteerArgs: LaunchOptions;
    private readonly maxCount: number;

    constructor(maxCount: number, puppeteerArgs: LaunchOptions) {
        this.puppeteerArgs = puppeteerArgs;
        this.maxCount = maxCount;
    }

    async create(): Promise<BrowserWrapper> {
        const browser = await puppeteer.launch(this.puppeteerArgs);
        return new BrowserWrapper(browser);
    }

    async destroy(browserWrapper: BrowserWrapper): Promise<void> {
        await browserWrapper.close();
    }

    async validate(browserWrapper: BrowserWrapper): Promise<boolean> {
        return !browserWrapper.ifClosed() && browserWrapper.useCount < this.maxCount;
    }
}
