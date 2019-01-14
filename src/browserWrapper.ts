import {Browser} from 'puppeteer';

export default class BrowserWrapper {
    private readonly browser: Browser;
    public useCount = 0;
    private closed = false;

    ifClosed(): Boolean {
        return this.closed;
    }
    incrementUseCount(): number{
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
        return this.browser;
    }
    constructor(browser: Browser) {
        this.browser = browser;
        this.browser.once('disconnected', this.setDisconnectStatus);
    }
}
