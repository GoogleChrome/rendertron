import {Browser} from 'puppeteer';

/***
 * Wrapper for Browser Object to maintain extra status for Browser
 */
export default class BrowserWrapper {
    private readonly browser: Browser;
    public useCount = 0;  // maintain count browser object is used
    private closed = false; // flag which is used to check if browser object is closed

    ifClosed(): Boolean {
        return this.closed;
    }

    private incrementUseCount(): number {
        this.useCount++;
        return this.useCount;
    }

    async close(): Promise<void> {
        await this.browser.close();
        this.closed = true;
    }

    setDisconnectStatus(): void {
        this.closed = true;
    }

    getBrowser(): Browser {
        this.incrementUseCount();
        return this.browser;
    }

    constructor(browser: Browser) {
        this.browser = browser;
        this.browser.once('disconnected', () => { // switch closed flag on browser disconnected flag
            this.setDisconnectStatus();
        });
    }
}
