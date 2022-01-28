import React, { useRef } from 'react';
import './styles.css';
import './App.css';
import Searchbar from './components/searchbar/SearchBar.js';
import { api, API_RESULT_KEYS, API_LOCAL_DEFAULTS, build_query_string } from './http/ApiClient.js';
import Table from './components/resultstable/Table.js';
import { range_string_to_sequence } from './components/searchbar/EpRange.js';
import TablePagination from './components/resultstable/UsePagination';
import OptionsButton from './components/buttons/OptionsButton.js'
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import { array_is_same, fast_hash_53 } from './utils/Algorithm.js';
import { SignalCellularConnectedNoInternet1Bar } from '@mui/icons-material';

// App class globals
const APP_DATA_PROVIDER         = api;
const APP_PREFETCHBUFFER_MAX    = 1;
const APP_HASH_SEED             = 69420;

const APP_FLAG_SUCCESS = (1 << 0);
const APP_FLAG_ERROR   = (1 << 1);
const APP_FLAG_FAILURE = (1 << 2);
const APP_ERRORS = {
    [APP_FLAG_SUCCESS]: {
        msg: 'success'
    },

    [APP_FLAG_ERROR]: {
        msg: 'error'
    },

    [APP_FLAG_FAILURE]: {
        msg: 'failure'
    }
};

const APP_RESULT_DEFAULT = {
    query: '',
    query_params: [],
    data: {
        [API_RESULT_KEYS.TOTAL_QUERY]:   0,
        [API_RESULT_KEYS.TOTAL_RESULTS]: 0,
        [API_RESULT_KEYS.MAX_QUERY]:     API_LOCAL_DEFAULTS.MAX_QUERY,
        [API_RESULT_KEYS.PAGE]:          0,
        [API_RESULT_KEYS.OFFSET]:        0,
        [API_RESULT_KEYS.LIMIT]:         0,
        [API_RESULT_KEYS.RESULTS]:       []
    },
    hash: () => { return fast_hash_53('', APP_HASH_SEED) }
};

const APP_QUERYPARAMS_DEFAULT = {
    projects: [],
    characters: [],
    episodes: [],
    lines: [],
    limit: 0,
    page: 0,
    offset: 0
};

// Styling theme globals
const APP_COLOUR_PRIMARY_BLUE = '#4da4f6';
const APP_COLOUR_PRIMARY_GREEN = '#007e00';
const APP_COLOUR_PRIMARY_RED = '#ff572d';
const APP_COLOUR_PRIMARY_WHITE = '#EEEEEE';
const APP_COLOUR_SECOND_WHITE = '#AAAAAA';

const APP_THEME = createTheme({
    components: {
        MuiLinearProgress: {
            styleOverrides: {
                bar1Indeterminate: {
                    backgroundColor: APP_COLOUR_PRIMARY_BLUE
                },

                bar2Indeterminate: {
                    backgroundColor: APP_COLOUR_PRIMARY_BLUE
                }
            }
        }
    }
});

export default class App extends React.Component {
    constructor(props) {
        // Call parent constructor
        super(props);

        // App stateful variables
        this.state = {
            // UI input fields
            projects: [],
            characters: [],
            episodes: [],
            lines: [],
            current_input_focus: 0,

            // Parameters used for previous query
            current_query: '',
            successful_results: false,
            current_query_parameters: APP_QUERYPARAMS_DEFAULT,

            // Buffer and control variables for managing results from API
            result: APP_RESULT_DEFAULT,
            result_overflow: [],
            result_overflow_page: 0,
            result_offset: 0,

            // State for WIP Rotating Prefetch Buffer Model
            _display_buffer_index = 0,
            _data_buffers: [],
            _overflow_buffer: [],
            
            // For prefetching data
            result_prefetch_1: APP_RESULT_DEFAULT,

            // Loading control variables for API queries
            awaiting_results: false,
            
            // Pagination variables
            page: 0,
            previous_page: 0,
            page_display_selection: 0,
            page_display_options: [12, 50, 125, 250],

            // Key-stroke state
            btn_last_pressed: '',
            key_timed_out: false
        };

        // Timer for various app level timing needs
        this.timers = 0;

        // Styling defaults
        this.table_row_size_px = 30;

        // References to DOM components
        this.projectsInput =   React.createRef();
        this.episodesInput =   React.createRef();
        this.charactersInput = React.createRef();
        this.linesInput =      React.createRef();
        this.tableHeader =     React.createRef();
        this.tableBody =       React.createRef();
        this.appHeader =       React.createRef();
        this.appSearchBar =    React.createRef();
        this.appPageSettings = React.createRef();
    }

    timeLastKeyPressed() {
        this.timer = setTimeout(() => {
            this.setState({ key_timed_out: true });
        }, 250);
    }

    getAvailableTableSpacePx() {
        // TODO: Non-negative safety check / any null case
        if (this.appHeader.current !== null
            && this.appSearchBar.current !== null
            && this.appPageSettings.current !== null
            && this.tableHeader.current !== null
            && this.tableBody.current !== null)
        {
            const screen_height = window.innerHeight;
            const header_height = this.appHeader.current.offsetHeight;
            const searchbar_height = this.appSearchBar.current.offsetHeight;
            const tableheader_height = this.tableHeader.current.offsetHeight;
            const pagesettings_height = this.appPageSettings.current.offsetHeight;
            const table_size = screen_height - (header_height + searchbar_height + tableheader_height + pagesettings_height);

            return table_size - 25;
        }

        return 0;
    }

    getRowSizePx() {
        let row_px = 0;
        const table_size = this.getAvailableTableSpacePx() - this.tableHeader.current.offsetHeight;
        const aspect_ratio = window.screen.width / window.screen.height;

        let aspect_coef = (aspect_ratio > 1.25) ? 22 : 10;
        row_px = table_size / aspect_coef;
        
        return {
            size_px: row_px,
            total_fit: aspect_coef
        };
    }

    getPageRowDisplay() {
        return this.state.page_display_options[this.state.page_display_selection];
    }

    getBackgroundColor() {
        let background_color = APP_COLOUR_PRIMARY_BLUE;

        // RED: Error result
        // GREEN: Success result

        const successful_results = this.state.successful_results;
        const have_results = this.state.result.data[API_RESULT_KEYS.TOTAL_RESULTS] > 0;
        const new_search = this.state.current_query_parameters

        if (have_results) {
            background_color = APP_COLOUR_PRIMARY_GREEN;
        } else if (successful_results && !have_results && !this.state.awaiting_results) {
            background_color = APP_COLOUR_PRIMARY_RED;
        }

        return background_color;
    }

    areFieldsEmpty() {
        return this.state.projects === ''   &&
               this.state.characters === '' &&
               this.state.episodes === ''   &&
               this.state.lines === '';
    }

    areReferencesReady() {
        const references_ready = this.tableBody.current !== null
                                 && this.projectsInput.current !== null
                                 && this.episodesInput.current !== null
                                 && this.charactersInput.current !== null
                                 && this.linesInput.current !== null
                                 && this.tableHeader.current !== null
                                 && this.tableBody.current !== null
                                 && this.appHeader.current !== null
                                 && this.appSearchBar.current !== null
                                 && this.appPageSettings.current !== null;

        return references_ready;
    }

    toggleTextInput(direction = 1) {
        // Default for next input state
        let next_input_focus = this.state.current_input_focus + direction;

        // Determine next focus state should wrap around
        if (next_input_focus > 3) {
            next_input_focus = 0;
        } else if (next_input_focus < 0) {
            next_input_focus = 3
        }

        // Set state for focus field
        this.setState({ current_input_focus: next_input_focus })

        // Set focus according to state
        switch (this.state.current_input_focus) {
            case 0: this.projectsInput.current.focus(); break;
            case 1: this.charactersInput.current.focus(); break;
            case 2: this.episodesInput.current.focus(); break;
            case 3: this.linesInput.current.focus(); break;
            default: console.error('[ERROR] no reference to input field was set'); break;
        }
    }

    setAppRefs(refs = []) {
        if (refs.length !== 0) {
            for (const wrapper of refs) {
                const k = Object.keys(wrapper)[0];
                this[k] = wrapper[k];
            }
        }
    }
    
    // Callback method for components to update project property state
    updateFieldState(key, value) {
        this.setState((s,p) => ({ [key]: value }));
    }

// ------------------------------------------------------------------------------------------------------------------------------------------
// START OF WIP IMPLEMENTATION FOR ROTATING PREFETCH BUFFER MODEL

    _isFlagSuccess(flag) {
        return flag === APP_FLAG_SUCCESS;
    }

    async _getPageData(offset = 0) {
        // Function constants
        const api_total_query = this.state.result.data[API_RESULT_KEYS.TOTAL_QUERY];
        const api_max_query = this.state.result.data[API_RESULT_KEYS.MAX_QUERY];
        const api_results = this.state.result.data[API_RESULT_KEYS.RESULTS];
        const api_current_page = this.state.result.data[API_RESULT_KEYS.PAGE];
        const total_page_slices = Math.ceil(api_total_query / this.getPageRowDisplay());
        const current_page_display = this.getPageRowDisplay();
        const next_local_page_requested = Math.max(0, Math.min(this.state.page, this.state.page + offset));

        // Make request for page
        const query_success = this._dispatchQuery({
            project: this.state.current_query_parameters.projects,
            episodes: this.state.current_query_parameters.episodes,
            characters: this.state.current_query_parameters.characters,
            lines: this.state.current_query_parameters.lines,
            limit: this.state.current_query_parameters.limit,
            page: next_local_page_requested,
            offset: this.state.current_query_parameters.offset
        });

        // Handle results of query
        if (!this._isFlagSuccess(query_success)) {
            return [];
        }

        // Slice up results for returning
        const display_buffer = this._getDisplayBuffer();
        const slice_start = (next_local_page_requested * current_page_display) - (api_current_page * api_max_query) + slice_offset;
        const slice_end = Math.min(results.length, slice_start + current_page_display);

        return display_buffer.slice(slice_start, slice_end);
    }

    _getDisplayBuffer() {
        return this.state._data_buffers[this.state._display_buffer_index].contents.data[API_RESULT_KEYS.RESULTS];
    }

    _rotateBuffers(direction = 0) {
        if (direction === 0) {
            console.log('[WARNING] cannot rotate buffers with a direction of 0');
            return APP_FLAG_ERROR;
        }

        return APP_FLAG_SUCCESS;
    }

    _dispatchQuery(parameters) {
        // TODO: Handle empty parameters

        // Fetch existing query parameters
        const qry_parameters = this.state.current_query_parameters;
        
        // Verify that data for requested parameters are not already available in data buffers
        let buffer_index = -1;
        const parameters_hash = this._hashParameters(parameters);
        for (let i = 0; i < this.state._data_buffers.length; i++) {
            if (this.state._data_buffers[i].hash === parameters_hash) buffer_index = i;
        }

        if (buffer_index === -1) {
            // TODO: Fill all three buffers
        } else if () {

        }

        // Build query string
        const { projects, episodes, characters, lines, limit, page, offset } = parameters;

        // Check if buffers
        
        return APP_FLAG_SUCCESS;
    }

    _queryDataProvider(qry = '') {

    }

    _getTotalAvailableBuffers() {
        return (APP_PREFETCHBUFFER_MAX * 2) + 1;
    }

// END OF WIP IMPLEMENTATION FOR ROTATING PREFETCH BUFFER MODEL
// ------------------------------------------------------------------------------------------------------------------------------------------

    async offsetPage(offset = 0) {
        // Determine new page number according to input offset
        const next_local_page_requested = (this.state.page + offset <= 0) ? 0 : this.state.page + offset;
        const total_local_page = Math.ceil(this.state.result.data[API_RESULT_KEYS.TOTAL_QUERY] / this.getPageRowDisplay());
        let next_local_page_state = 0;

        if (next_local_page_requested < 0) {
            next_local_page_state = 0;
        } else if (next_local_page_requested >= total_local_page) {
            next_local_page_state = this.state.page;
        } else {
            next_local_page_state = next_local_page_requested;
        }
        
        // Pages for local current results and swap buffer results
        const remote_max_query = this.state.result.data[API_RESULT_KEYS.MAX_QUERY];
        const current_results_page = this.state.result.data[API_RESULT_KEYS.PAGE];
        const swap_results_page = this.state.result_prefetch_1.data[API_RESULT_KEYS.PAGE];

        // Determine if we've cycled up & down past the mid-way point of the remote page
        const direction_up   = next_local_page_state * this.getPageRowDisplay() - (current_results_page * remote_max_query) > Math.floor(remote_max_query / 2) && this.state.page > this.state.previous_page;
        const direction_down = next_local_page_state * this.getPageRowDisplay() - (current_results_page * remote_max_query) < Math.floor(remote_max_query / 2) && this.state.page < this.state.previous_page;

        // Determine if we're swapping buffers
        const ne_current_offset = Math.floor(next_local_page_state * this.getPageRowDisplay() / remote_max_query) !== current_results_page;
        
        // Create offset value for new pre-fetch query according to specified input offset and within the bounds of min/max pagination values
        const new_offset = (Math.floor(next_local_page_state * this.getPageRowDisplay() / remote_max_query) + offset <= 0)
            ? 0
            : Math.floor(next_local_page_state * this.getPageRowDisplay() / remote_max_query) + offset;
        
        // Calculate missing entries from current buffer to fill last page
        const max_mod_pages = Math.floor(remote_max_query % this.getPageRowDisplay());
        const total_missing_buffer = this.getPageRowDisplay() - max_mod_pages + (max_mod_pages * current_results_page);

        if (this.state.result_offset !== total_missing_buffer) this.setState({ result_offset: total_missing_buffer });

         // Pre-fetch data for new page and fill overflow buffer
         if (current_results_page >= swap_results_page && direction_up || current_results_page <= swap_results_page && direction_down && (current_results_page !== 0 && swap_results_page !== 0)) {
            console.log('[MESSAGE] pre-fetching data from API');
            // console.log('current page', current_results_page,'swap page', swap_results_page)
            // TODO: This is no longer being called asyncronously - handle case if pre-fetch failed
            // TODO: Add promise failure callback
            this.lineSearch(false, true, new_offset).then(() => {
                this.setState({
                    result_overflow: this.state.result_prefetch_1.data[API_RESULT_KEYS.RESULTS].slice(0, this.state.result_offset),
                    result_overflow_page: swap_results_page
                });
            });
        }

        // Fill overflow buffer when empty and prefetch data is available
        const prefetch_ready = this.state.result_prefetch_1.data[API_RESULT_KEYS.RESULTS].length > 0;
        const overflow_same = this.state.result_overflow_page === current_results_page;

        if (total_missing_buffer > 0
            && overflow_same
            && prefetch_ready)
        {
            this.setState({
                result_overflow: this.state.result_prefetch_1.data[API_RESULT_KEYS.RESULTS].slice(0, total_missing_buffer),
                result_overflow_page: swap_results_page
            });
        }

        // Swap buffers if we've reached the end of the current buffer
        if (ne_current_offset) {
            console.log('[MESSAGE] swapping results with pre-fetched buffer');
            this.swapResultBuffers();
        }

        // Update page state
        this.updateFieldState('previous_page', this.state.page);
        this.updateFieldState('page', next_local_page_state);
    }

    // Callback method for preparing user search inputs and querying database
    async lineSearch(new_query, prefetch = false, page = 0, offset = 0, limit = 0) {
        // Storage for parsed user input
        let list_episodes = [];
        let list_projects =   (new_query) ? [] : this.state.current_query_parameters.projects;
        let list_characters = (new_query) ? [] : this.state.current_query_parameters.characters;
        let list_lines =      (new_query) ? [] : this.state.current_query_parameters.lines;
        let eps_sequence =    (new_query) ? [] : this.state.current_query_parameters.episodes;

        // Query hrefs with parameters
        let qry_href = '';
        let qry_page   = (new_query) ? 0 : page;
        let qry_offset = (new_query) ? 0 : offset;
        
        // Collect user input from form fields
        const user_input = [
            {project: this.state.projects,     data: list_projects   },
            {episode: this.state.episodes,     data: list_episodes   },
            {character: this.state.characters, data: list_characters },
            {line: this.state.lines,           data: list_lines      }
        ]
        
        // Determine if new search is only white space
        const re_space = new RegExp('^ *$');
        const invalid_search = (re_space.test(this.state.projects))
                              && (re_space.test(this.state.characters))
                              && (re_space.test(this.state.episodes))
                              && (re_space.test(this.state.lines));

        // TODO: Handle invalid searches in UI
        if (invalid_search) return;
        
        if (new_query && !invalid_search) {
            
            // Parse and seperate user options
            for (const i of user_input) {
                const k = Object.keys(i)[0];
                let delimiter = '';
                
                
                if (k === 'episode' || k === 'character') {
                    // Handle case where user uses | as delimiter
                    // TODO: Use better procedure for testing which delimiter is being used
                    const re_delimiter = new RegExp('\\|');
                    
                    if (re_delimiter.test(i[k])) delimiter = '|';
                    else delimiter = ',';
                    
                } else if (k === 'project' || k === 'line') {
                    delimiter = '|';
                }
                
                const dirty_data = i[k].split(delimiter);
                for (const n of dirty_data) {
                    i['data'].push(n.trim().toLowerCase());
                }
            }
            
            // Transform ranged episodes to a sequence of comma-seperated values
            // TODO: Constrain max range to prevent user from generating too many numbers
            eps_sequence = range_string_to_sequence(list_episodes);

            // Build the URL based on user inputs
            // TODO: Backwards offset for swap buffer query
            qry_href = build_query_string(list_projects, eps_sequence, list_characters, list_lines, 0, qry_page, qry_offset);

            // Handle if current query parameters are the same as previous
            // TODO: Display message in UI for identical query parameters
            // console.log('current query', this.state.current_query, 'new query', qry_href);
            list_projects.sort();
            list_episodes.sort();
            list_characters.sort();
            list_lines.sort();

            const identical_query = array_is_same(list_projects, this.state.current_query_parameters.projects)
                                    && array_is_same(list_episodes, this.state.current_query_parameters.episodes)
                                    && array_is_same(list_characters, this.state.current_query_parameters.characters)
                                    && array_is_same(list_lines, this.state.current_query_parameters.lines)
                                    && qry_page === this.state.current_query_parameters.page
                                    && qry_offset === this.state.current_query_parameters.offset;

            if (identical_query) {
                console.log('[MESSAGE] current query parameters matches previous: skipping search');
                return;
            }
            
            // Update state for current query parameters
            // Clear current results
            this.setState({
                 page: 0,
                 result: APP_RESULT_DEFAULT,
                 current_query: qry_href,
                 current_query_parameters: {
                    projects: list_projects,
                    episodes: list_episodes,
                    characters: list_characters,
                    lines: list_lines,
                    page: qry_page,
                    offset: qry_offset
                 }
            });
        } else {
            qry_href = build_query_string(list_projects, eps_sequence, list_characters, list_lines, 0, qry_page, qry_offset);
        }
        
        // Make query to the API
        try {
            // Set flag for pending results from API if current buffer is empty
            // console.log('load state', this.state.result.data[API_RESULT_KEYS.RESULTS].length <= 0 && !prefetch);
            if (this.state.result.data[API_RESULT_KEYS.RESULTS].length <= 0 && !prefetch) this.setState({ awaiting_results: true });

            if (!invalid_search) console.log('[MESSAGE] making call to API with href:', qry_href);
            const qry_response = ((!invalid_search)
                ? await api.get(qry_href)
                : { status: 0 }
            );
            
            // TODO: Cancel search if no valid input parameters were passed
            // TODO: Various response validation before setting results
            // TODO: Set UI to loading state for potential long response times from API
            
            // Check if data is valid and store relevant data in payload
            const qry_data = ((qry_response.status === 200)
                ? qry_response.data
                : APP_RESULT_DEFAULT.data
            );
            
            const results = {
                query: qry_href,
                query_params: [list_projects, eps_sequence, list_characters, list_lines, qry_page, qry_offset],
                data: qry_data
            }
            
            // Set state for results
            // TODO: Manage syncronisation of swap buffers
            if (prefetch) {
                this.setState({result_prefetch_1: results});
            } else {
                this.setState({result: results});
            }
            
            if (qry_response.status === 200) this.setState({ successful_results: true });
            else this.setState({ successful_results: false });

            // Reset flag for pending results from API
            if (this.state.awaiting_results) this.setState({ awaiting_results: false });
        } catch (e) {
            // TODO: handle failed query in UI
            console.error(`[ERROR] query to API failed with message: ${e}`);
        }
    }
    
    // Method for clearing search fields
    clearSearch(clear_results = true) {
        // Clear UI input fields
        this.setState({
            projects: '',
            characters: '',
            episodes: '',
            lines: ''
        });

        // Clear app search state
        if (clear_results) {
            this.setState({
                page: 0,
                result: APP_RESULT_DEFAULT,
                result_overflow : [],
                result_overflow_page: 0,
                result_offset: 0,
                current_query: '',
                current_query_parameters: APP_QUERYPARAMS_DEFAULT,
                successful_results: false,
                result_prefetch_1: APP_RESULT_DEFAULT,
                awaiting_results: false
            });
        }
    }

    async refreshBuffers() {
        console.log('awaiting results', this.state.awaiting_results);
        if (!this.state.awaiting_results) {
            // Current page information
            const current_remote_page = this.state.result.data[API_RESULT_KEYS.PAGE];
            const current_swap_remote_page = this.state.result_prefetch_1.data[API_RESULT_KEYS.PAGE];
            const required_remote_page = Math.floor(this.state.page * this.getPageRowDisplay() / this.state.result.data[API_RESULT_KEYS.MAX_QUERY]);

            // Check if required page is same as current page
            const ne_local_remote_page = required_remote_page !== current_remote_page;
    
            // Check if required data is present in swap buffer
            const ne_required_page_in_swap = required_remote_page !== current_swap_remote_page;
    
            if (ne_local_remote_page) {
                const new_offset = Math.max(0, required_remote_page);
    
                console.log('new page', new_offset);
    
                // Fill primary results buffer with new page
                if (ne_required_page_in_swap) {
                    console.log('resize new search');
                    await this.lineSearch(false, false, new_offset);
                } else {
                    console.log('resize swap');
                    this.swapResultBuffers(true);
                }

                // Fill swap buffer with closest next page
                const closest_swap_page = (this.state.page * this.getPageRowDisplay() - (this.state.result.data[API_RESULT_KEYS.PAGE] * this.state.result.data[API_RESULT_KEYS.MAX_QUERY]) >= Math.floor(this.state.result.data[API_RESULT_KEYS.MAX_QUERY] / 2))
                ? Math.min(Math.ceil(this.state.result.data[API_RESULT_KEYS.MAX_QUERY] / this.getPageRowDisplay()), this.state.result.data[API_RESULT_KEYS.PAGE] + 1)
                : Math.max(0, this.state.result.data[API_RESULT_KEYS.PAGE] - 1);
            
                const ne_required_swap_page = Math.floor(this.state.page * this.getPageRowDisplay() / this.state.result_prefetch_1.data[API_RESULT_KEYS.MAX_QUERY]) !== this.state.result_prefetch_1.data[API_RESULT_KEYS.PAGE];
                if (ne_required_swap_page) {
                    console.log('new swap page', closest_swap_page);
                    await this.lineSearch(false, true, closest_swap_page);
                }

                // Update overflow buffer with new swap buffer
                const max_mod_pages = Math.floor(this.state.result.data[API_RESULT_KEYS.MAX_QUERY] % this.getPageRowDisplay());
                const total_missing_buffer = this.getPageRowDisplay() - max_mod_pages + (max_mod_pages * this.state.result.data[API_RESULT_KEYS.PAGE]);

                if (total_missing_buffer > 0) {
                    this.setState({
                        result_overflow: this.state.result_prefetch_1.data[API_RESULT_KEYS.RESULTS].slice(0, total_missing_buffer),
                        result_overflow_page: this.state.result_prefetch_1.data[API_RESULT_KEYS.PAGE]
                    });
                } else {
                    this.setState({
                        result_overflow: [],
                        result_overflow_page: 0
                    });
                }
            }
        }
    }

    swapResultBuffers(reset_overflow = false) {
        // Temporarily store current results
        const temp_result = this.state.result;
        const temp_overflow = (reset_overflow) ? [] : this.state.result.data[API_RESULT_KEYS.RESULTS].slice(0, this.state.result_offset);

        this.setState({
            // Update overflow buffers with new prefetched buffer data
            result_overflow: temp_overflow,

            // Set current buffers to prefetch data
            result: this.state.result_prefetch_1,
            
            // Set prefetch buffers to current results
            result_prefetch_1: temp_result
        });
    }

    refreshTable() {
        // Make sure DOM references have been set
        if (this.areReferencesReady()) {
            document.documentElement.style.setProperty('--table-max-size', `${this.getAvailableTableSpacePx()}px`);
            document.documentElement.style.setProperty('--table-data-max-size', `${this.getAvailableTableSpacePx() - this.tableHeader.current.offsetHeight}px`);
            document.documentElement.style.setProperty('--table-row-height', `${this.getRowSizePx()['size_px']}px`);
        }
    }

    componentDidMount() {
        // Listen for shortcuts
        window.addEventListener('keydown', async (e) => {
            // console.log(e.key);
            // console.log(this.state.btn_last_pressed);

            // Developer keys
            if (e.key === '\`') {
                this.getRowSizePx();
            }
            
            // Get modifier state
            const modifier_key = (window.navigator.platform === 'Win32') ? (e.ctrlKey && e.shiftKey) : e.metaKey;
            const ctrl_key = (window.navigator.platform === 'Win32') ? (e.altKey && e.shiftKey) : e.ctrlKey;
            const shift_key = e.shiftKey;

            // Make a line search on Ctrl/Cmd + Enter
            if (e.key === 'Enter' && modifier_key) {
                await this.lineSearch(true);
            }
            
            // Change results to previous page on Ctrl/Cmd + Left
            if (e.key === 'ArrowLeft' && modifier_key) {
                e.preventDefault();
                this.offsetPage(-1);
            }
            
            // Change results to next page on Ctrl/Cmd + Right
            if (e.key === 'ArrowRight' && modifier_key) {
                e.preventDefault();
                this.offsetPage(1);
            }
            
            // Clear search fields on 1x Escape
            if (e.key === 'Escape') {
                const inputs = [
                    {key: 'projects',   element: this.projectsInput.current   },
                    {key: 'episodes',   element: this.episodesInput.current   },
                    {key: 'characters', element: this.charactersInput.current },
                    {key: 'lines',      element: this.linesInput.current      }
                ];
                
                let active = '';
                for (const input of inputs) {
                    const is_same = document.activeElement === input['element'];
                    if (is_same) {
                        active = input['key'];
                    }
                }
                
                if (active !== '') {
                    this.updateFieldState(active, '');
                }

                // Reset state if all fields are empty
                const are_fields_empty = this.areFieldsEmpty();
                if (are_fields_empty) this.setState({ successful_results: !are_fields_empty });
            }
            
            // Clear clear search results on 2x Escape
            // ANUPAMAA
            if (e.key === 'Escape' && this.state.btn_last_pressed === 'Escape' && !this.state.key_timed_out)
            {
                this.clearSearch(true);
                this.projectsInput.current.focus();
                this.setState({ current_input_focus: 0 });
            }

            // Change page display to level 1
            if (e.key === '1' && ctrl_key) {
                this.setState({ page_display_selection: 0 });
            }

            // Change page display to level 2
            if (e.key === '2' && ctrl_key) {
                this.setState({ page_display_selection: 1 });
            }

            // Change page display to level 3
            if (e.key === '3' && ctrl_key) {
                this.setState({ page_display_selection: 2 });
            }

            // Change page display to level 4
            if (e.key === '4' && ctrl_key) {
                this.setState({ page_display_selection: 3 });
            }

            // Navigate left to right on Shift + Tab
            if (e.key === 'Tab' && !shift_key) {
                e.preventDefault();
                this.toggleTextInput(1);
            } else if (e.key === 'Tab' && shift_key) {
                e.preventDefault();
                this.toggleTextInput(-1);
            }

            // Store state for currently pressed button
            this.setState({ btn_last_pressed: e.key });

            // Reset timeout for last key pressed & set timer
            this.setState({ key_timed_out: false });
            this.timeLastKeyPressed();
        });

        // Window resizing event listener
        window.addEventListener('resize', (e) => {
            if (this.getPageRowDisplay() !== this.getRowSizePx()['total_fit']) {
                // Handle total row change
                const updated_options = this.state.page_display_options.map((c, i) => {
                    if (i === 0) return this.getRowSizePx()['total_fit'];
                    else return c;
                });
                this.setState({ page_display_options: updated_options });

                // Handle new last page
                if (this.state.page >= Math.ceil(this.state.result.data[API_RESULT_KEYS.TOTAL_QUERY] / this.getPageRowDisplay()) - 1) {
                    this.setState({
                        page: Math.ceil(this.state.result.data[API_RESULT_KEYS.TOTAL_QUERY] / this.getPageRowDisplay()) - 1,
                        previous_page: Math.ceil(this.state.result.data[API_RESULT_KEYS.TOTAL_QUERY] / this.getPageRowDisplay()) - 2
                    });
                }

                // Handle data in buffers according to new page sizing
                this.refreshBuffers();
            }

            
            // Reset computed CSS properties for table display
            this.refreshTable();
        });

        // Update page display based on mounted DOM references
        this.setState({ page_display_options: [this.getRowSizePx()['total_fit'], 50, 125, 250] });

        // Reset computed CSS properties for table display
        this.refreshTable();
    }

    componentWillUnmount() {
        window.removeEventListener('keydown', (e) => {
            // TODO
        });

        window.removeEventListener('resize', (e) => {
            // TODO
        });
    }
    
    componentDidUpdate(prev_props, prev_state) {
        // Clear app timers
        clearTimeout(this.timer);
    }

    render() {
        // Handle background color based on query results
        const backgroundColor = this.getBackgroundColor();

        return (
            <div style={{ backgroundColor: backgroundColor }} className='App'>
                {
                    this.state.awaiting_results
                    &&
                    <ThemeProvider theme={APP_THEME}>
                        <Box sx={{ width: '100%', position: 'absolute', left: '0px', top: '0px' }}>
                            <LinearProgress variant='query'/>
                        </Box>
                    </ThemeProvider>
                }
                <h1 ref={this.appHeader} className='header'>AAP Lore</h1>
                <Searchbar
                    updateFieldCallbacks={{
                            updateProjects:   (ref) => { this.updateFieldState('projects', ref);            },
                            updateEpisodes:   (ref) => { this.updateFieldState('episodes', ref);            },
                            updateCharacters: (ref) => { this.updateFieldState('characters', ref);          },
                            updateLines:      (ref) => { this.updateFieldState('lines', ref);               },
                            updateInputFocus: (ref) => { this.updateFieldState('current_input_focus', ref); },
                        }
                    }
                    setRefCallbacks={{
                        updateProjectsRef:     (ref) => { this.setAppRefs([{projectsInput: ref}])   },
                        updateEpisodesRef:     (ref) => { this.setAppRefs([{episodesInput: ref}])   },
                        updateCharactersRef:   (ref) => { this.setAppRefs([{charactersInput: ref}]) },
                        updateLinesRef:        (ref) => { this.setAppRefs([{linesInput: ref}])      },
                        updateAppSearchBarRef: (ref) => { this.setAppRefs([{appSearchBar: ref}])    },
                    }}
                    project={this.state.projects}
                    character={this.state.characters}
                    episode={this.state.episodes}
                    line={this.state.lines}
                    page={this.state.page}
                />
                <div className='table-wrapper'>
                    <Table
                        page={this.state.page}
                        rowsPerPage={this.getPageRowDisplay()}
                        searchResult={this.state.result}
                        overflowResult={this.state.result_overflow}
                        resultOffset={this.state.result_offset}
                        loadingState={this.state.awaiting_results}
                        setRefCallbacks={{
                            updateTableHeadRef: (ref) => { this.setAppRefs([{ tableHeader: ref }]); },
                            updateTableBodyRef: (ref) => { this.setAppRefs([{ tableBody: ref }]);   },
                        }}
                    />
                    <div className='dummy-bottom-spacer'></div>
                    <div ref={this.appPageSettings} className='table-nav-container'>
                        <OptionsButton
                            currentOptionIndex={this.state.page_display_selection}
                            optionsList={this.state.page_display_options}
                            displayValue={(index, value) => (index > 0) ? `Display: ${value}` : 'Display: Fit' }
                            updateCallback={(value) => { if (value >= this.state.page_display_options.length) value = 0; this.updateFieldState('page_display_selection', value); this.refreshBuffers(); this.refreshTable(); }}
                        />
                        <TablePagination
                            className='pagination-bar'
                            results={this.state.result}
                            refreshTableCallback={() => { this.refreshTable(); }}
                            page={this.state.page}
                            rowsPerPage={this.getPageRowDisplay()}
                            updatePageCallback={(v) => { this.offsetPage(v); }}
                        />
                        <div style={{ marginRight: '3rem', visibility: 'hidden' }}>{this.getPageRowDisplay()}</div>
                    </div>
                </div>
            </div>
        );
    }
}
