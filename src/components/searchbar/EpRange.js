/**
* Generates a sequence of integers from `start` to `end`
* @param {Int} start start of integer sequence
* @param {Int} end end of integer sequence
*/
export function generate_sequence(start, end) {
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
    
