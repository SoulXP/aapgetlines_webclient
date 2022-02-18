import React, { useRef } from 'react';
import './styles.css';
import './App.css';
import Searchbar from './components/searchbar/SearchBar.js';
import { api, API_RESULT_KEYS, API_LOCAL_DEFAULTS, build_query_string } from './http/ApiClient.js';
import Table from './components/resultstable/Table.js';
import TablePagination from './components/table/TablePagination.js';
import OptionsButton from './components/buttons/OptionsButton.js'
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import { array_is_same, fast_hash_53, primitive_to_string, range_string_to_sequence, rotl, rotr } from './utils/Algorithm.js';

// App class globals
const APP_DATA_PROVIDER         = api;
const APP_PREFETCHBUFFER_MAX    = 1;
const APP_HASH_SEED             = 69420;

const APP_FLAG_SUCCESS = 1 << 0;
const APP_FLAG_ERROR   = 1 << 1;
const APP_FLAG_FAILURE = 1 << 2;
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

const APP_QUERYPARAMS_DEFAULT = {
    projects: [],
    characters: [],
    episodes: [],
    lines: [],
    limit: 0,
    page: 0,
    offset: 0
};

const APP_RESULT_DEFAULT = {
    query: '',
    query_params: APP_QUERYPARAMS_DEFAULT,
    hash: () => { return fast_hash_53(primitive_to_string(APP_RESULT_DEFAULT), APP_HASH_SEED) },
    data: {
        [API_RESULT_KEYS.TOTAL_QUERY]:   0,
        [API_RESULT_KEYS.TOTAL_RESULTS]: 0,
        [API_RESULT_KEYS.MAX_QUERY]:     API_LOCAL_DEFAULTS.MAX_QUERY,
        [API_RESULT_KEYS.PAGE]:          0,
        [API_RESULT_KEYS.OFFSET]:        0,
        [API_RESULT_KEYS.LIMIT]:         0,
        [API_RESULT_KEYS.RESULTS]:       []
    }
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
            projects: '',
            characters: '',
            episodes: '',
            lines: '',
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
            _display_buffer_index: 0,
            _result_offset: 0,
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

        const successful_results = this.state.successful_results;
        const have_results = this._getBufferTotalRemoteResults() > 0;

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

    _consumeUserInput() {
        // Storage for parsed user input
        let list_episodes = [];
        let list_projects = [];
        let list_characters = [];
        let list_lines = [];
        let eps_sequence = [];
        
        // Collect user input from form fields
        const user_input = [
            {project: this.state.projects,     data: list_projects   },
            {episode: this.state.episodes,     data: list_episodes   },
            {character: this.state.characters, data: list_characters },
            {line: this.state.lines,           data: list_lines      }
        ];

        // Determine if new search is only white space
        const re_space = new RegExp('^ *$');
        const invalid_search = (re_space.test(this.state.projects))
                            && (re_space.test(this.state.characters))
                            && (re_space.test(this.state.episodes))
                            && (re_space.test(this.state.lines));

        // TODO: Handle invalid searches in UI
        if (invalid_search) return APP_FLAG_FAILURE;
            
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
                                && this.state.page === this.state.current_query_parameters.page
                                && this.state.offset === this.state.current_query_parameters.offset;

        if (identical_query) {
            console.log('[MESSAGE] current query parameters matches previous: skipping search');
            return APP_FLAG_SUCCESS;
        }
        
        // Update state for current query parameters
        // Clear current results
        this.setState({
            page: 0,
            result: APP_RESULT_DEFAULT,
            current_query_parameters: {
                projects: list_projects,
                episodes: list_episodes,
                characters: list_characters,
                lines: list_lines,
                limit: 0,
                page: 0,
                offset: 0
            }
        });

        return APP_FLAG_SUCCESS;
    }

    _offsetPage(offset = 0) {
        const next_page = this.state.page + offset;
        const api_total_query = this._getBufferTotalRemoteResults();
        const total_page_slices = Math.floor(api_total_query / this.getPageRowDisplay());
        const next_local_page = Math.max(0, Math.min(next_page, total_page_slices));
        this.setState({ page: next_local_page });
    }

    _getPageData() {
        // Function constants
        const api_max_query        = this._getBufferMaxRemoteResults();
        const api_current_page     = this._getBufferRemotePage();
        const current_page_display = this.getPageRowDisplay();
        const current_local_page   = this.state.page;

        if (this._getTotalStoredBuffers() === 0) return [];

        // Slice up results for returning
        const display_buffer = (api_current_page < this._getTotalStoredBuffers())
            ? [...this._getDisplayBuffer(), ...this._getOverflowBuffer()]
            : [...this._getDisplayBuffer()];

        const slice_offset = this.state._result_offset;
        const slice_delta = (current_local_page * current_page_display) - (api_current_page * api_max_query);
        const slice_start = Math.max(0, slice_delta);
        const slice_end = Math.min(display_buffer.length, slice_start + current_page_display);
        
        return display_buffer.slice(slice_start, slice_end);
    }

    _getDisplayBuffer() {
        if (this._getTotalStoredBuffers() === 0) return APP_RESULT_DEFAULT;
        return this.state._data_buffers[this.state._display_buffer_index].data[API_RESULT_KEYS.RESULTS];
    }
    
    _getOverflowBuffer() {
        return this.state._overflow_buffer;
    }

    _getBufferMaxRemoteResults(index = this.state._display_buffer_index) {
        if (this._getTotalStoredBuffers() === 0) return APP_RESULT_DEFAULT[API_RESULT_KEYS.MAX_QUERY];
        return this.state._data_buffers[index].data[API_RESULT_KEYS.MAX_QUERY];
    }

    _getBufferTotalRemoteResults(index = this.state._display_buffer_index) {
        if (this._getTotalStoredBuffers() === 0) return APP_RESULT_DEFAULT[API_RESULT_KEYS.TOTAL_QUERY];
        return this.state._data_buffers[index].data[API_RESULT_KEYS.TOTAL_QUERY];
    }

    _getTotalRemotePages() {
        if (this._getTotalStoredBuffers() === 0) return 0;
        return Math.floor(this._getBufferTotalRemoteResults() / this._getBufferMaxRemoteResults());
    }

    _getBufferTotalReturnedResults(index = this.state._display_buffer_index) {
        if (this._getTotalStoredBuffers() === 0) return APP_RESULT_DEFAULT[API_RESULT_KEYS.TOTAL_RESULTS];
        return this.state._data_buffers[index].data[API_RESULT_KEYS.TOTAL_RESULTS];
    }
    
    _getBufferRemotePage(index = this.state._display_buffer_index) {
        if (this._getTotalStoredBuffers() === 0) return APP_RESULT_DEFAULT[API_RESULT_KEYS.PAGE];
        return this.state._data_buffers[index].data[API_RESULT_KEYS.PAGE];    
    }

    _getTotalAllowedBuffers() {
        return (APP_PREFETCHBUFFER_MAX * 2) + 1;
    }

    _getTotalStoredBuffers() {
        return this.state._data_buffers.length;
    }

    _refreshBuffers() {
        const api_total_query = this._getBufferMaxRemoteResults();
        const total_page_slices = Math.floor(api_total_query / this.getPageRowDisplay());
        const api_max_query = this._getBufferMaxRemoteResults();
        const api_current_page = this._getBufferRemotePage();
        const max_mod_pages = Math.floor(api_max_query % this.getPageRowDisplay());
        const total_missing_buffer = this.getPageRowDisplay() - max_mod_pages + (max_mod_pages * api_current_page);
        const api_next_page_in_bounds = this._getBufferTotalReturnedResults(this.state._display_buffer_index + 1) > 0;

        if (this.state._result_offset !== total_missing_buffer) {
            this.setState({
                _result_offset: total_missing_buffer,
                _overflow_buffer: this.state._data_buffers[this.state._display_buffer_index + 1].data[API_RESULT_KEYS.RESULTS].slice(0, total_missing_buffer),
            });
        }

        const local_gt_slices = this.state.page > total_page_slices * (this._getBufferRemotePage() + 1);
        const local_lt_slices = this.state.page < total_page_slices * (this._getBufferRemotePage());

        let buffer_index_offset = 0;
        if (api_next_page_in_bounds && local_gt_slices) {
            buffer_index_offset = 1;
        } else if (local_lt_slices) {
            buffer_index_offset = -1;
        }
        
        const rotate_result = this._rotateBuffers(buffer_index_offset);

        return APP_FLAG_SUCCESS;
    }

    async _rotateBuffers(direction = 0) {
        if (direction === 0) {
            console.log('[MESSAGE] cannot rotate buffers with a direction of 0');
            return APP_FLAG_FAILURE;
        }

        const current_buffer_is_start = this.state._display_buffer_index === 0;
        const current_buffer_is_mid   = this.state._display_buffer_index === Math.floor(this._getTotalStoredBuffers() / 2);
        const current_buffer_is_end   = this.state._display_buffer_index === this._getTotalStoredBuffers() - 1;
        let new_buffer_index = this.state._display_buffer_index + 1;

        if (current_buffer_is_start) {
            // TODO
        } 
        
        else if (current_buffer_is_mid) {
            //    1 2 3 rotr
            // -> 3 1 2 shift
            // -> _ 1 2 unshift
            // -> 0 1 2

            //    0 1 2 rotl
            // -> 1 2 0 pop
            // -> 1 2 _ push
            // -> 1 2 3

            const { projects, episodes, characters, lines, limit, page, offset } = this.state._data_buffers[this.state._display_buffer_index].query_params;
            const boundary_index = (direction > 0) ? this._getTotalStoredBuffers() - 1 : 0;
            const qry_page_offset = (direction > 0) ? 1 : -1;
            const boundary_page = this.state._data_buffers[boundary_index].query_params.page + qry_page_offset;
            const total_remote_results = this._getBufferTotalRemoteResults() / this.getPageRowDisplay();
            const new_page = Math.max(0, Math.min(boundary_page, total_remote_results));
            
            const new_qry = build_query_string(projects, episodes, characters, lines, limit, new_page, offset);
            
            const insert_query = (direction > 0)
                ? async () => { return this._insertQueryIntoBuffer(new_qry, { projects, episodes, characters, lines, limit, page: new_page, offset }, true);  }
                : async () => { return this._insertQueryIntoBuffer(new_qry, { projects, episodes, characters, lines, limit, page: new_page, offset }, false); };

            insert_query().then(
                (flag_success) => {
                    if (!this._isFlagSuccess(flag_success)) {
                        console.log('[MESSAGE] rotating buffers failed when trying to replenish with more data from API');
                        return;
                    }

                    const buffer_index = Math.floor(this._getTotalStoredBuffers() / 2);
                    this.setState({ _display_buffer_index: buffer_index });
                },

                (e) => {
                    console.log(`[ERROR]: could not insert new query when rotating buffers: ${e}`);
                }
            );

        }
        
        else if (current_buffer_is_end) {
            // TODO
        }
        
        
        this.setState({ _display_buffer_index: new_buffer_index });
        return APP_FLAG_SUCCESS;
    }

    _hashParameters(p) {
        return fast_hash_53(primitive_to_string(p), APP_HASH_SEED);
    }

    async _dispatchQuery(parameters) {
        if (this._getTotalStoredBuffers() > 0) {
            // TODO
        } else {
            // Build query URI
            const { projects, episodes, characters, lines, limit, page, offset } = parameters;
            
            let qry_urls = [];

            this.setState({ awaiting_results: true });
            
            for (let i = 0; i < this._getTotalAllowedBuffers(); i++) {
                qry_urls.push({
                    url: build_query_string(projects, episodes, characters, lines, limit, page + i, offset),
                    parameters: { projects, episodes, characters, lines, limit, page: page + i, offset }
                });
            }

            if (!this._isFlagSuccess(await this._fillBuffersWithQueries(qry_urls, parameters))) {
                // Handle UI state
                console.log('[MESSAGE] could not fill buffers with provided parameters');
                this.setState({ successful_results: false });
                return APP_FLAG_FAILURE;
            }
        }
        
        this.setState({ awaiting_results: false });
        this.setState({ successful_results: true });
        return APP_FLAG_SUCCESS;
    }

    _clearSearch(clear_results = true) {
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
                awaiting_results: false,
                _display_buffer_index: 0,
                _result_offset: 0,
                _data_buffers: [],
                _overflow_buffer: []
            });
        }
    }

    _buildBufferObject(url, parameters, results) {
        return {
            query: url,
            query_params: parameters,
            hash: () => { return fast_hash_53(primitive_to_string(parameters), APP_HASH_SEED) },
            data: results
        };
    }

    async _insertQueryIntoBuffer(url = '', parameters = APP_QUERYPARAMS_DEFAULT, at_end = true) {
        if (url.trim().length === 0) {
            console.log('[WARNING] no URLs were provided to query API');
            return APP_FLAG_FAILURE;
        }

        const update_buffers = (at_end)
            ? (v, r) => { const rv = rotl(v); rv.pop();   rv.push(r);    }
            : (v, r) => { const rv = rotr(v); rv.shift(); rv.unshift(r); };

        const new_element = await this._queryDataProvider(url);

        if (!this._isFlagSuccess(new_element.flag)) {
            console.log(`[MESSAGE] query to API with URL ${url} had no results`);
            return APP_FLAG_FAILURE;
        }

        const buffer_object = this._buildBufferObject(url, parameters, new_element.result);
        update_buffers(this.state._data_buffers, buffer_object);
        
        return APP_FLAG_SUCCESS;
    }

    async _fillBuffersWithQueries(urls = []) {
        if (urls.length === 0) {
            console.log('[WARNING] no URLs were provided to query API');
            return APP_FLAG_FAILURE;
        }
        
        let results = [];
        for (const u of urls) {
            const qry_result = await this._queryDataProvider(u.url);
            
            if (this._isFlagSuccess(qry_result.flag)) {
                const result = this._buildBufferObject(u.url, u.parameters, qry_result.result);
                results.push(result);
            }
        }
        
        if (results.length > 0) this.setState({ _data_buffers: [...results] });
        else console.log('[MESSAGE] query to API had no results');

        return APP_FLAG_SUCCESS;
    }

    async _queryDataProvider(qry = '') {
        if (qry === '') {
            console.log('[WARNING] cannot make query to data provider with an empty query');
            return { flag: APP_FLAG_FAILURE, result: APP_RESULT_DEFAULT.data };
        }

        // TODO: Verify format of query string before calling data provider
        try {
            console.log('[MESSAGE] making call to API with href:', qry);
            const qry_response = await APP_DATA_PROVIDER.get(qry);

            const qry_data = ((qry_response.status === 200)
                ? qry_response.data
                : APP_RESULT_DEFAULT.data
            );

            return { flag: APP_FLAG_SUCCESS, result: qry_data };
        } catch (e) {
            console.log(`[ERROR] query to API failed: ${e}`);
        }

        return { flag: APP_FLAG_FAILURE, result: APP_RESULT_DEFAULT };
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
                // await this.lineSearch(true);
                this._consumeUserInput();
                this._dispatchQuery(this.state.current_query_parameters);
            }
            
            // Change results to previous page on Ctrl/Cmd + Left
            if (e.key === 'ArrowLeft' && modifier_key) {
                e.preventDefault();
                // this.offsetPage(-1);
                this._offsetPage(-1);
                this._refreshBuffers();
            }
            
            // Change results to next page on Ctrl/Cmd + Right
            if (e.key === 'ArrowRight' && modifier_key) {
                e.preventDefault();
                // this.offsetPage(1);
                this._offsetPage(1);
                this._refreshBuffers();
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
            if (e.key === 'Escape' && this.state.btn_last_pressed === 'Escape' && !this.state.key_timed_out)
            {
                // this.clearSearch(true);
                this._clearSearch(true);
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
                            updateProjects:    (v) => { this.updateFieldState('projects', v);             },
                            updateEpisodes:    (v) => { this.updateFieldState('episodes', v);             },
                            updateCharacters:  (v) => { this.updateFieldState('characters', v);           },
                            updateLines:       (v) => { this.updateFieldState('lines', v);                },
                            updateQueryParams: (v) => { this.updateFieldState('current_query_params', v); },
                            updateInputFocus:  (v) => { this.updateFieldState('current_input_focus', v);  },
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
                        searchResult={this._getPageData()}
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
                            totalResults={this._getBufferTotalRemoteResults()}
                            refreshTableCallback={() => { this.refreshTable(); }}
                            page={this.state.page}
                            rowsPerPage={this.getPageRowDisplay()}
                            updatePageCallback={(v) => { this._offsetPage(v); }}
                        />
                        <div style={{ marginRight: '3rem', visibility: 'hidden' }}>{this.getPageRowDisplay()}</div>
                    </div>
                </div>
            </div>
        );
    }
}
