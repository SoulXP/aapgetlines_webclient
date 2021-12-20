import { API_QRY_URL, API_QRY_PARAMETERS} from '../http/ApiClient.js';

export default function buildQueryString(projects = [], episodes = [], characters = [], lines = [], page = 0, offset = 0) {
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

    // Control variable for adding offset to query
    const add_offset = projects.length > 0 || episodes.length > 0 || characters.length > 0 || lines.length > 0;

    // Set offset for pagination
    if (add_offset) {
        urlParams.searchParams.append(`${API_QRY_PARAMETERS['PAGE']}`, page);
        if (offset > 0) urlParams.searchParams.append(`${API_QRY_PARAMETERS['OFFSET']}`, offset);
    }

    return urlParams.href;
}