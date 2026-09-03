import { readFile } from 'node:fs/promises';
import { validateConfig } from '../src/config.js';
const base = new URL('../Présidentielles 2027/', import.meta.url);
const [balance, layout, buildings, prototype] = await Promise.all(['game_balance.json', 'world_layout.json', 'building_catalog.json', 'prototype_config.json'].map(async f => JSON.parse(await readFile(new URL(f, base), 'utf8'))));
export const config = validateConfig({ balance, layout, buildings, prototype });
