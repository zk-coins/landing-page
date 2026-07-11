import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      // The site ships no JavaScript, so there is no product code to unit-test.
      // What IS unit-tested to 100% is the pure logic behind the test/check
      // tooling in scripts/lib/** (path/URL/reference parsing, the visual matrix,
      // MIME lookup). The side-effecting scripts (dev-server, check-site,
      // check-visual) are exercised by CI running them against the real site.
      include: ['scripts/lib/**/*.mjs'],
      // Report every matched file even if no test imports it, so a new, untested
      // scripts/lib/*.mjs drops coverage below 100% instead of silently passing.
      all: true,
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
