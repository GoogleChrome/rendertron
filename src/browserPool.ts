import {Pool, createPool, Options} from 'generic-pool';
import {LaunchOptions} from 'puppeteer';
import BrowserPoolFactory from './browserPoolFactory';
import BrowserWrapper from './browserWrapper';

/**
 * Class to maintain pool of browser objects of particular configuration
  */
export class BrowserPool {
    private options: Options = { // options for generic pool
        idleTimeoutMillis: 300000,
        max: 10,
        min: 2,
        testOnBorrow: true,
    };
    private maxUses = 50; // number of times a browser object can be used before being discarded
    private pool: Pool<BrowserWrapper>;

    constructor(browserArgs?: LaunchOptions, poolOptions?: Options) {
        if (poolOptions) {
            Object.assign(this.options, poolOptions);
        }
        const factory = new BrowserPoolFactory(this.maxUses, browserArgs);
        this.pool = createPool(factory, this.options);
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
        browserWrapper.incrementUseCount();
        const result = await fn(browserWrapper.getBrowser());
        await this.pool.release(browserWrapper);
        return result;
    }
}
