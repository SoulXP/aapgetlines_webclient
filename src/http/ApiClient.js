import axios, { Axios } from 'axios';

// API URL globals
export const API_BASE_URL = 'http://api.aaplore.com:8081';
export const API_QRY_URL = `${API_BASE_URL}/q`;

// Globals for IDs that queries to API will be expecting
export const API_QRY_PARAMETERS = {
    PROJECTS: 'projects',
    CATALOGUES: 'catalogues',
    SEGMENTS: 'eps',
    NAMES: 'names',
    LINES: 'lines',
    PAGE: 'page',
    OFFSET: 'offset',
    LIMIT: 'limit'
}

// Globals for key IDs in results payload that API queries will return
export const API_RESULT_KEYS = {
    TOTAL_QUERY: 'total_query',
    TOTAL_RESULTS: 'total_results',
    MAX_QUERY: 'max_query',
    PAGE: 'current_page',
    OFFSET: 'current_offset',
    LIMIT: 'current_limit',
    RESULTS: 'results',
    PROJECT: 'project_name',
    CATALOGUE: 'project_catalogue',
    SEGMENT: 'project_segment',
    CHARACTER: 'character_name',
    LINE: 'prepared_cue',
    TIMECODE: 'timeline_values',
    FRAME_RATE: 'frame_rate',
    TICK_RATE: 'tick_rate'
};

export const API_LOCAL_DEFAULTS = {
    MAX_QUERY: 250
};

// Axios http client instance, configured for GET requests to API line search endpoint
export const api = axios.create({ 
    baseURL: `${API_QRY_URL}`,
    timeout: 10000,
    method: 'get',
    responseType: 'json'
 });

 // Build query string for this API
 export function build_query_string(projects = [], episodes = [], characters = [], lines = [], limit = 0, page = 0, offset = 0) {
    // Helpers for various delimiter types;
    const comma_delimit = (p, c) => {
        return p + ',' + c;
    };
    
    const ampersands_delimit = (p, c) => {
        return p + '&&' + c;
    };
    
    // Conditionally create query string values for various options
    const projects_compiled =   (projects.length > 0)   ? ((projects > 1)   ? projects[0]   : projects.reduce(ampersands_delimit)) : '';
    const episodes_compiled =   (episodes.length > 0)   ? ((episodes > 1)   ? episodes[0]   : episodes.reduce(comma_delimit))      : '';
    const characters_compiled = (characters.length > 0) ? ((characters > 1) ? characters[0] : characters.reduce(comma_delimit))    : '';
    const lines_compiled =      (lines.length > 0)      ? ((lines > 1)      ? lines[0]      : lines.reduce(ampersands_delimit))    : '';

    // Build final query URL
    const urlParams = new URL(`${API_QRY_URL}`);
    if (projects_compiled !== '')   urlParams.searchParams.append(`${API_QRY_PARAMETERS['PROJECTS']}`, projects.reduce(ampersands_delimit));
    if (episodes_compiled !== '')   urlParams.searchParams.append(`${API_QRY_PARAMETERS['SEGMENTS']}`, episodes.reduce(comma_delimit));     
    if (characters_compiled !== '') urlParams.searchParams.append(`${API_QRY_PARAMETERS['NAMES']}`,    characters.reduce(comma_delimit));   
    if (lines_compiled !== '')      urlParams.searchParams.append(`${API_QRY_PARAMETERS['LINES']}`,    lines.reduce(ampersands_delimit));   
    
    // Set limit for query
    if (limit > 0) urlParams.searchParams.append(`${API_QRY_PARAMETERS['LIMIT']}`, limit);
    
    // Control variable for adding offset to query
    const add_offset = projects.length > 0 || episodes.length > 0 || characters.length > 0 || lines.length > 0;

    // Set offset for pagination
    if (add_offset) {
        urlParams.searchParams.append(`${API_QRY_PARAMETERS['PAGE']}`, page);
        if (offset > 0) urlParams.searchParams.append(`${API_QRY_PARAMETERS['OFFSET']}`, offset);
    }


    return urlParams.href;
}
