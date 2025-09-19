/*
Tests for README.md file.
Dummy test just to check if Github Actions is working.
*/

import fs from 'fs';
import { test } from 'node:test';
import { strictEqual } from 'assert';

test('README.md file exists', () => {
  const exists = fs.existsSync('README.md');
  strictEqual(exists, true, 'README.md should exist');
});
