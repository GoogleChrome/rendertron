/*
 * Copyright 2018 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

import {test} from 'ava';

import InMemoryLRUCache from '../InMemoryLRUCache';

const promiseTimeout = function(timeout: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });
};

test('maxEntries is not breached', async (t) => {
    const cacheStore = new InMemoryLRUCache<string>(1);
    cacheStore.set('key1', 'dummy value 1');
    cacheStore.set('key2', 'dummy value 2');
    // @ts-ignore
    t.is(cacheStore.store.size, 1);
});

test('when maxEntries breach last first set value if not used is removed', async (t) => {
    const cacheStore = new InMemoryLRUCache<string>(1);
    cacheStore.set('key1', 'dummy value 1');
    cacheStore.set('key2', 'dummy value 2');
    t.is(cacheStore.get('key1'), undefined);
    t.is(cacheStore.get('key2'), 'dummy value 2');
});

test('when maxEntries breach last second set value removed if first set value us used', async (t) => {
    const cacheStore = new InMemoryLRUCache<string>(2);
    cacheStore.set('key1', 'dummy value 1');
    cacheStore.set('key2', 'dummy value 2');

    // usage of first set value
    cacheStore.get('key1');

    // breach of maxEntries
    cacheStore.set('key3', 'dummy value 3');

    // key2 is second set value which would removed on maxEntries breach
    t.is(cacheStore.get('key2'), undefined);

    // key1 is first set value which would still be present on maxEntries breach
    t.is(cacheStore.get('key1'), 'dummy value 1');
});

test('when cache expiry is respected', async (t) => {
    const cacheStore = new InMemoryLRUCache<string>(1);
    cacheStore.set('key1', 'dummy value 1', 400);
    t.is(cacheStore.get('key1'), 'dummy value 1');

    await promiseTimeout(401).then(() => {
        t.is(cacheStore.get('key1'), undefined);
    });
});

test('remove the entry when expired item is accessed', async (t) => {
    const cacheStore = new InMemoryLRUCache<string>(1);
    cacheStore.set('key1', 'dummy value 1', 400);
    t.is(cacheStore.get('key1'), 'dummy value 1');

    await promiseTimeout(401).then(() => {
        cacheStore.get('key1');

        // @ts-ignore
        t.is(cacheStore.store.size, 0);
    });
});
