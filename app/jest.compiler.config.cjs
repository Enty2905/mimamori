const base = require('./package.json').jest;
module.exports = {
  ...base,
  testTimeout: 30000,
  testMatch: ['<rootDir>/src/features/navigation/**/*.test.tsx'],
  transform: {'\.[jt]sx?$': '<rootDir>/../scripts/jest-compiler-transform.cjs'},
};
