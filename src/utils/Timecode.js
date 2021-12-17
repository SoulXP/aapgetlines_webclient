
// Globals for module
const MICROSECONDS = 10000000.0;
const NANOSECONDS = 1000000000.0;
const N_RESOLUTION = MICROSECONDS;

// TODO: Fix precision/rounding error for floats
export function float_to_tc(n, frame_rate, tick_rate) {
    if (n === 0) return '00:00:00:00';

    let h = 0.0;
    let m = 0.0;
    let s = 0.0;
    let f = 0.0;

    if (n >= 60.0 * 60.0 * tick_rate) {
        h = n / (60.0 * 60.0 * tick_rate);
        h = Math.trunc(h);
        n = n % (60.0 * 60.0 * tick_rate);
    }
    
    if (n >= 60.0 * tick_rate) {
        m = n / (60.0 * tick_rate);
        m = Math.trunc(m);
        n = n % (60.0 * tick_rate);
    }
    
    if (n >= tick_rate) {
        s = n / tick_rate;
        s = Math.trunc(s);
        n = n % tick_rate;
    }

    f = Math.round(n * frame_rate / tick_rate);

    const hs = (h.toString().length === 1) ? '0' + h.toString() : h.toString();
    const ms = (m.toString().length === 1) ? '0' + m.toString() : m.toString();
    const ss = (s.toString().length === 1) ? '0' + s.toString() : s.toString();
    const fs = (f.toString().length === 1) ? '0' + f.toString() : f.toString();

    return `${hs}:${ms}:${ss}:${fs}`;
}

export function tc_to_float(tc, frame_rate, tick_rate) {
    let h = 0.0;
    let m = 0.0;
    let s = 0.0;
    let f = 0.0;

    const chunks = tc.split(':') // TODO: Handle drop-frame with ; delimiter
    
    h = parseFloat(chunks[0]) * 60.0 * 60.0;
    m = parseFloat(chunks[1]) * 60.0;
    s = parseFloat(chunks[2]);
    f = parseFloat(chunks[3]) / frame_rate;

    return (h + m + s + f) * tick_rate;
}
