
'use strict';

class Entry<T> {
    public value: T;
    public expiry?: number;
    public createdAt?: number;

    constructor(value: T, expiry: number|undefined) {
        this.value = value;
        if(expiry) {
            this.expiry = expiry;
            this.createdAt = (new Date()).getTime();
        }
    }

}

export default class InMemoryLRUCache<T> {
    private store: Map<string, Entry<T>> = new Map<string, Entry<T>>();
    private maxEntries: number = 20;

    public get(key: string): T|undefined {
        const entry: Entry<T>|undefined = this.store.get(key);
        if (entry && entry.value) {
            if (!entry.expiry || !entry.createdAt || (entry.expiry + entry.createdAt) < (new Date()).getTime()) {
                this.store.delete(key);
                this.store.set(key, entry);
                return entry.value;
            }
        }
        return undefined;
    }

    public set(key: string, value: T, expiry?: number) {

        if (this.store.size >= this.maxEntries) {
            // least-recently used cache eviction strategy
            const keyToDelete = this.store.keys().next().value;

            this.store.delete(keyToDelete);
        }
        this.store.set(key, new Entry<T>(value, expiry));
    }

}
