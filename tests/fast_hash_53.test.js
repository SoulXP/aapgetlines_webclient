import { assert } from 'chai';
import { fast_hash_53 } from '../src/utils/Algorithm.js';

describe('Fast Hash 53', () => {
    const iterations = 1000000;
    const hash_string = 'hello world!';
    const expected = fast_hash_53(hash_string);

    it(`${iterations} passes for constant value: '${hash_string}'`, () => {
        for (let i = 0; i < iterations; i++) {
            const hash = fast_hash_53(hash_string);
            assert.equal(hash, expected, `fast_hash_53 failed on iteration ${i} of ${iterations} iterations\n
                                          input: ${hash_string}\n
                                          output: ${hash}\n
                                          expected: ${expected}\n`);
        }
    });
});