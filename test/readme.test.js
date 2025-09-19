/*
Tests for README.md file.
Dummy test just to check if Github Actions is working.
*/

import fs from 'fs';
import { test, strictEqual } from 'node:test';

test('README.md file exists', () => {
  const exists = fs.existsSync('README.md');
  strictEqual(exists, true, 'README.md should exist');
});
