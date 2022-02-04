import { describe, expect, it } from '@jest/globals';
import { fast_hash_53, primitive_to_string, get_type, rotl, rotr } from '../src/utils/Algorithm.js';
import regeneratorRuntime from "regenerator-runtime";

// Fast Hash 53 Suite
describe('Fast Hash 53', () => {
    const iterations = 10000;
    const seed = 333;
    const hash_string = 'hello world!';
    const expected = fast_hash_53(hash_string, seed);

    it(`${iterations} passes for constant value: '${hash_string}'`, () => {
        for (let i = 0; i < iterations; i++) {
            expect(fast_hash_53(hash_string, seed))
            .toBe(expected);
        }
    });

    it(`${iterations} passes for simple primitive type`, () => {
        const primitive = primitive_to_string('hello');
        const primitive_expected = fast_hash_53(primitive, seed);
        for (let i = 0; i < iterations; i++) {
            expect(fast_hash_53(primitive, seed))
            .toBe(primitive_expected);
        }
    });

    it(`${iterations} passes for simple nested primitive type`, () => {
        const primitive = primitive_to_string(
            {
                a: 0,
                b: 0n,
                c: 'c',
                d: [],
                e: {}
            }
        );
        const primitive_expected = fast_hash_53(primitive, seed);
        for (let i = 0; i < iterations; i++) {
            expect(fast_hash_53(primitive, seed))
            .toBe(primitive_expected);
        }
    });

    it(`${iterations} passes for complex nested primitive type`, () => {
        const primitive = primitive_to_string(
            {
                a: 0,
                b: 0n,
                c: 'c',
                d: [ 0, 0n, 'd', { a: 0, b: 0n, c: 'c', d: [] } ],
                e: { a: 0, b: 0n, c: 'c', d: {} }
            }
        );
        const primitive_expected = fast_hash_53(primitive, seed);
        for (let i = 0; i < iterations; i++) {
            expect(fast_hash_53(primitive, seed))
            .toBe(primitive_expected);
        }
    });
});

// Get Type Suite
describe('Type to String Conversion', () => {
    const tests = [
        { msg: 'Array Type',                                   expected: 'array',                      param1: [],                                            param2: false },
        { msg: 'Array Full Type',                              expected: '[object array]',             param1: [],                                            param2: true  },
        { msg: 'BigInt Type',                                  expected: 'bigint',                     param1: 0n,                                            param2: false },
        { msg: 'BigInt Full Type',                             expected: '[object bigint]',            param1: 0n,                                            param2: true  },
        { msg: 'Date Type',                                    expected: 'date',                       param1: new Date(),                                    param2: false },
        { msg: 'Date Full Type',                               expected: '[object date]',              param1: new Date(),                                    param2: true  },
        { msg: 'Error Type',                                   expected: 'error',                      param1: new Error(),                                   param2: false },
        { msg: 'Error Full Type',                              expected: '[object error]',             param1: new Error(),                                   param2: true  },
        { msg: 'Lambda Function Type',                         expected: 'function',                   param1: () => {},                                      param2: false },
        { msg: 'Lambda Function Full Type',                    expected: '[object function]',          param1: () => {},                                      param2: true  },
        { msg: 'Regular Function Type',                        expected: 'function',                   param1: function() {},                                 param2: false },
        { msg: 'Regular Function Full Type',                   expected: '[object function]',          param1: function() {},                                 param2: true  },
        { msg: 'Generator Function Type',                      expected: 'generatorfunction',          param1: function*() {},                                param2: false },
        { msg: 'Generator Function Full Type',                 expected: '[object generatorfunction]', param1: function*() {},                                param2: true  },
        { msg: 'Object Type',                                  expected: 'object',                     param1: {},                                            param2: false },
        { msg: 'Object Full Type',                             expected: '[object object]',            param1: {},                                            param2: true  },
        { msg: 'Generic Object Type : URL()',                  expected: 'object',                     param1: new URL('https://helloworld.com'),             param2: false },
        { msg: 'Generic Object Full Type : URL()',             expected: '[object object]',            param1: new URL('https://helloworld.com'),             param2: true  },
        { msg: 'Generic Object Type : URLSearchParams()',      expected: 'object',                     param1: new URLSearchParams('https://helloworld.com'), param2: false },
        { msg: 'Generic Object Full Type : URLSearchParams()', expected: '[object object]',            param1: new URLSearchParams('https://helloworld.com'), param2: true  },
        { msg: 'Null Type',                                    expected: 'null',                       param1: null,                                          param2: false },
        { msg: 'Null Full Type',                               expected: '[object null]',              param1: null,                                          param2: true  },
        { msg: 'Number Type',                                  expected: 'number',                     param1: 0,                                             param2: false },
        { msg: 'Number Full Type',                             expected: '[object number]',            param1: 0,                                             param2: true  },
        { msg: 'NaN Type',                                     expected: 'number',                     param1: NaN,                                           param2: false },
        { msg: 'NaN Full Type',                                expected: '[object number]',            param1: NaN,                                           param2: true  },
        { msg: 'RegExp Literal Type',                          expected: 'regexp',                     param1: /.*/,                                          param2: false },
        { msg: 'RegExp Literal Full Type',                     expected: '[object regexp]',            param1: /.*/,                                          param2: true  },
        { msg: 'RegExp Constructor Type',                      expected: 'regexp',                     param1: new RegExp(),                                  param2: false },
        { msg: 'RegExp Constructor Full Type',                 expected: '[object regexp]',            param1: new RegExp(),                                  param2: true  },
        { msg: 'String Type',                                  expected: 'string',                     param1: '',                                            param2: false },
        { msg: 'String Full Type',                             expected: '[object string]',            param1: '',                                            param2: true  },
        { msg: 'Symbol Type',                                  expected: 'symbol',                     param1: Symbol(),                                      param2: false },
        { msg: 'Symbol Full Type',                             expected: '[object symbol]',            param1: Symbol(),                                      param2: true  },
        { msg: 'Undefined Type',                               expected: 'undefined',                  param1: undefined,                                     param2: false },
        { msg: 'Undefined Full Type',                          expected: '[object undefined]',         param1: undefined,                                     param2: true  },
    ];     

    for (const t of tests) {
        it(t['msg'], () => {
            expect(get_type(t['param1'], t['param2']))
            .toBe(t['expected']);
        })
    }
})

// Primitive To String Suite
describe('Primitive to String Conversion', () => {
    const data = [{a: 1, b: 'hello'}, {c: [1,2,3], d: {}}, 3, 4];
    const expected = '[{a:1,b:\'hello\'},{c:[1,2,3],d:{}},3,4]';

    const tests = [
        { msg: 'Number Conversion',                    expected: '0', param1: 0 },
        { msg: 'BigInt Conversion',                    expected: '0n', param1: 0n },
        { msg: 'Empty String Conversion',              expected: '\'\'', param1: '' },
        { msg: 'String Conversion',                    expected: '\'\'hello world\'\'', param1: '\'hello world\'' },
        { msg: 'Empty Array Conversion',               expected: '[]', param1: [] },
        { msg: '1D Array Conversion',                  expected: '[0,0n,\'\',\'\'hello world\'\']', param1: [0, 0n, '', '\'hello world\''] },
        { msg: '2D Array Conversion',                  expected: '[0,0n,\'\',\'\'hello world\'\',[0,0n,\'\',\'\'hello world\'\']]', param1: [0, 0n, '', '\'hello world\'', [0, 0n, '', '\'hello world\'']] },
        { msg: 'Array with Nested Objects Conversion', expected: '[0,0n,\'\',\'\'hello world\'\',{a:0,b:0n,c:\'\',d:\'\'hello world\'\',e:[0,0n,\'\',\'\'hello world\'\']}]', param1: [0, 0n, '', '\'hello world\'', { a: 0, b: 0n, c: '', d: '\'hello world\'', e: [0, 0n, '', '\'hello world\''] }] },
        { msg: 'Empty Object Conversion',              expected: '{}', param1: {} },
        { msg: 'Nested Object Conversion',             expected: '{a:0,b:0n,c:\'\',d:\'\'hello world\'\',e:{a:0,b:0n,c:\'c\',d:\'\'hello world\'\',e:{a:{}}}}', param1: { a: 0, b: 0n, c: '', d: '\'hello world\'', e: {a: 0, b: 0n, c: 'c', d: '\'hello world\'', e: {a :{}}} } },
    ];

    for (const t of tests) {
        it(t['msg'], () => {
            expect(primitive_to_string(t['param1']))
            .toBe(t['expected']);
        });
    }
});

// Array algorithms
describe('Array Algorithms', () => {
    const tests = [
        { msg: 'Rotate Left Once',     expected: [2,3,1], f: rotl, param1: [1,2,3], param2: 1 },
        { msg: 'Rotate Left Twice',    expected: [3,1,2], f: rotl, param1: [1,2,3], param2: 2 },
        { msg: 'Rotate Left 5 Times',  expected: [3,1,2], f: rotl, param1: [1,2,3], param2: 5 },
        { msg: 'Rotate Right Once',    expected: [3,1,2], f: rotr, param1: [1,2,3], param2: 1 },
        { msg: 'Rotate Right Twice',   expected: [2,3,1], f: rotr, param1: [1,2,3], param2: 2 },
        { msg: 'Rotate Right 5 Times', expected: [2,3,1], f: rotr, param1: [1,2,3], param2: 5 },
    ];

    for (const t of tests) {
        it(t['msg'], () => {
            expect(t['f'](t['param1'], t['param2']))
            .toStrictEqual(t['expected']);
        });
    }
});