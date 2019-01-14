import {Pool, createPool, Options} from 'generic-pool';
import {LaunchOptions} from 'puppeteer';
import BrowserPoolFactory from './browserPoolFactory';
import BrowserWrapper from './browserWrapper';

export class BrowserPool {
    private options: Options = {
        idleTimeoutMillis: 30000,
        max: 10,
        min: 2,
        testOnBorrow: true,
    };
    private maxUses = 50;
    private pool: Pool<BrowserWrapper>;

    constructor(browserArgs?: LaunchOptions, poolOptions?: Options) {
        if (poolOptions) {
            Object.assign(this.options, poolOptions);
        }
        const factory = new BrowserPoolFactory(this.maxUses, browserArgs);
        this.pool = createPool(factory, this.options);
    }
    async aquire(fn: Function) {
        const browserWrapper: BrowserWrapper = await this.pool.acquire();
        browserWrapper.incrementUseCount();
        const result = await fn(browserWrapper.getBrowser());
        await this.pool.release(browserWrapper);
        return result;
    }
}
