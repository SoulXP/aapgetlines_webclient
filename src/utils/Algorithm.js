export function array_is_same(a, b) {
    return Array.isArray(a)
           && Array.isArray(b)
           && a.length === b.length
           && a.every((v, i) => v === b[i]);
}