/*
 * Copyright 2018 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 not
 * use this file except in compliance with the License. You may obtain a copy
 of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 under
 * the License.
 */

'use strict';

import * as fse from 'fs-extra';
import * as path from 'path';

const CONFIG_PATH = path.resolve(__dirname, '../config.json');


export type Config = {
    datastoreCache: boolean;
    timeout: number;
    port: string;
    width: number;
    height: number;
};

export class ConfigManager {
    public static config: Config = {
        datastoreCache: false,
        timeout: 10000,
        port: '3000',
        width: 1000,
        height: 1000,
    };

    static async getConfiguration(): Promise<Config> {
        // Load config.json if it exists.
        if (fse.pathExistsSync(CONFIG_PATH)) {
            ConfigManager.config = Object.assign(ConfigManager.config, await fse.readJson(CONFIG_PATH));
        }
        return ConfigManager.config;
    }
}

