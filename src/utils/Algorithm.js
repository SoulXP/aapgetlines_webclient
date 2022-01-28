export function array_is_same(a, b) {
    return Array.isArray(a)
           && Array.isArray(b)
           && a.length === b.length
           && a.every((v, i) => v === b[i]);
}

function get_type(obj, show_full_class) {

    // get toPrototypeString() of obj (handles all types)
    if (show_full_class && typeof obj === 'object') {
        return Object.prototype.toString.call(obj);
    }
    if (obj == null) { return (obj + '').toLowerCase(); }

    const deepType = Object.prototype.toString.call(obj).slice(8,-1).toLowerCase();
    if (deepType === 'generatorfunction') { return 'function' }

    // Prevent overspecificity (for example, [object HTMLDivElement], etc).
    return deepType.match(/^(array|bigint|date|error|function|generator|regexp|symbol)$/)
        ? deepType
        : (typeof obj === 'object' || typeof obj === 'function')
            ? 'object'
            : typeof obj;
  }

export function primitive_to_string(p) {
    let str = '';

    // Number type
    switch (get_type(p, true)) {
        case 'array': break;
        case 'bigint': break;
        case 'date': break;
        case 'error': break;
        case 'function': break;
        case 'generator': break;
        case 'null': break;
        case 'number': break;
        case 'object': break;
        case 'regexp': break;
        case 'symbol': break;
        case 'undefined': break
    }

    return str;
}

// https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
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