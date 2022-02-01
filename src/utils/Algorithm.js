// TODO: Tests
export function array_is_same(a, b) {
    return Array.isArray(a)
           && Array.isArray(b)
           && a.length === b.length
           && a.every((v, i) => v === b[i]);
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