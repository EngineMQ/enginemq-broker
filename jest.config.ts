import type { Config } from '@jest/types';
import { name } from './package.json';

const config: Config.InitialOptions = {
  displayName: name,
  rootDir: '.',
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.json',
    },
  },
  testEnvironment: 'node',
  testRegex: '\\.(test|spec)\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  preset: 'ts-jest',
  verbose: true,
  detectOpenHandles: true,
};
export default config;
