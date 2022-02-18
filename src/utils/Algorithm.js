// TODO: Tests
export function array_is_same(a, b) {
    return Array.isArray(a)
           && Array.isArray(b)
           && a.length === b.length
           && a.every((v, i) => v === b[i]);
}

// TODO: Tests
export function rotl(a, n = 1) {
    if (a.length === 0) return a;

    for (let i = 0; i < n; i++) {
        const first = a.shift();
        a.push(first);
    }

    return a;
}

// TODO: Tests
export function rotr(a, n = 1) {
    if (a.length === 0) return a;

    for (let i = 0; i < n; i++) {
        const last = a.pop();
        a.unshift(last);
    }

    return a;
}

export function get_type(obj, show_full_class = false) {
    const deep_type = Object.prototype.toString.call(obj).toLowerCase();
    const object_deep_type = Object.prototype.toString.call({}).toLowerCase();
    const re_types = /(array|bigint|date|error|function|generatorfunction|regexp|symbol|number|string|null|undefined)/;

    if (show_full_class) {
        if (deep_type.match(re_types)) return deep_type;
        else return object_deep_type;
    } else {
        if (deep_type.match(re_types)) return deep_type.slice(8,-1);
        else return object_deep_type.slice(8,-1);
    }
}

export function primitive_to_string(p) {
    let str = '';
    let i = 0;

    // Number type
    switch (get_type(p)) {    
        case 'bigint':
            str += `${p.toString()}n`;
            break;
        case 'number':
            str += p.toString();
            break;

        case 'string':
            str += `'${p.toString()}'`;
            break;

        case 'array':
            str += '[';
            i = 0;
            for (const e of p) {
                str += primitive_to_string(e);
                if (i < p.length - 1) str += ',';
                i++;
            }
            str += ']';
            break;

        case 'object':
            const keys = Object.keys(p);
            i = 0;
            str += '{'
            for (const k of keys) {
                str += `${k}:${primitive_to_string(p[k])}`;
                if (i < keys.length - 1) str += ',';
                i++;
            }
            str += '}'
            break;

        // TODO: Handle these types
        case 'date':              return 'date';
        case 'function':          return 'function';
        case 'generatorfunction': return 'generatorfunction';
        case 'symbol':            return 'symbol';
        case 'error':             return 'error';
        case 'regexp':            return 'regexp';
        case 'null':              return 'null';
        case 'undefined':         return 'undefined';
    }

    return str;
}

// SOURCE: https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
export function fast_hash_53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
    h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1>>>0);
}

/**
* Generates a sequence of integers from `start` to `end`
* @param {Int} start start of integer sequence
* @param {Int} end end of integer sequence
*/
export function generate_sequence(start, end) {
    // TODO: Tests
    let s = start;
    let e = end;
    let sequence = [];
    
    if (start > end) {
        s = end;
        e = start;
    }
    
    for (; s <= e; s++) {
        sequence.push(s);
    }
    
    return sequence;
}

/**
* Takes an array of strings, that potentially contains string values that denote a range of episodes.
* Splits string values in `ranges` by `delimiter` and generates an array containing a sequence of
* integers based on start and end values of split string
* @param {String[]} ranges array of strings containing episode strings
* @param {String} delimiter string to use as a delimiter for splitting strings in ranges
*/
export function range_string_to_sequence(ranges, delimiter = ':') {
    // TODO: Tests
    let all_sequences = [];
    const re_range = new RegExp(`^\\d+${delimiter}\\d+$`, 'gi');
    const re_digits = new RegExp('^\\d+$');
    
    for (const e of ranges) {
        let sequence = [];
        if (re_range.test(e)) {
            const start_end = e.split(delimiter);
            const sequence = generate_sequence(parseInt(start_end[0]), parseInt(start_end[1]));
            all_sequences = all_sequences.concat(
                sequence.filter((c) => { return c >= 0 })
            );
        } else if (re_digits.test(e)){
            all_sequences.push(parseInt(e));
        }
    }
        
    return [...new Set(all_sequences)];
}
    

