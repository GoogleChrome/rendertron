import {Pool, createPool, Options} from 'generic-pool';
import {LaunchOptions} from 'puppeteer';
import BrowserPoolFactory from './browserPoolFactory';
import BrowserWrapper from './browserWrapper';

export interface BrowserPoolConfig {
    browserMaxUse: number;
    poolSettings: Options;
    browserArgs: LaunchOptions;
}

/**
 * Class to maintain pool of browser objects of particular configuration
  */
export class BrowserPool {
    private readonly config: BrowserPoolConfig;
    private pool: Pool<BrowserWrapper>;

    constructor(browserPoolConfig: BrowserPoolConfig) {
        this.config = browserPoolConfig;
        const factory = new BrowserPoolFactory(this.config.browserMaxUse, this.config.browserArgs);
        this.pool = createPool(factory, this.config.poolSettings);
    }

    /**
     * function to acquire a browser object from pool and automatically
     * release back to pool on resolve of callback function
     *
     * @param fn - async callback function which receives browser object
     * and on resolve of which browser object released back to pool
     */
    async acquire(fn: Function) {
        const browserWrapper: BrowserWrapper = await this.pool.acquire();
        const result = await fn(browserWrapper.getBrowser());
        await this.pool.release(browserWrapper);
        return result;
    }
}
