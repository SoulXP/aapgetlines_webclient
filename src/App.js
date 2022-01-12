import React from 'react';
import './styles.css';
import './App.css';
import Searchbar from './components/searchbar/SearchBar.js';
import { api, API_RESULT_KEYS, API_LOCAL_DEFAULTS } from './http/ApiClient.js';
import Table from './components/resultstable/Table.js';
import buildQueryString from './utils/QueryUrl.js';
import { epRangesToSequences } from './components/searchbar/EpRange.js';
import TablePagination from './components/resultstable/UsePagination';
import { ThermostatOutlined } from '@mui/icons-material';

const result_default = {
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
    }
};

export default class App extends React.Component {
    constructor(props) {
        // Call parent constructor
        super(props);

        // App stateful variables
        this.state = {
            // Search variables
            projects: '',
            characters: '',
            episodes: '',
            lines: '',
            current_input_focus: 0,
            current_query: '',
            successful_results: false,
            are_fields_empty: true,
            current_query_parameters: {
                projects: [],
                characters: [],
                episodes: [],
                lines: [],
                page: 0,
                offset: 0,
                limit: 0
            },
            result: result_default,
            result_overflow: [],
            result_overflow_page: 0,
            result_offset: 0,
            
            // For prefetching data
            result_prefetch: result_default,

            // For missing data due to differentials with page sizing and API max queries
            // result_missing: result_default,
            
            // Pagination variables
            page: 0,
            previous_page: 0,
            rows_per_page: Math.floor((0.84 * window.screen.height) / 40), // 84% and 40 are magic numbers for now
            row_size: 10,

            // User environment variables
            user_screen_width: window.screen.width,
            user_screen_height: window.screen.height,

            // Key-stroke state
            btn_last_pressed: ''
        };

        // References to DOM components
        this.projectInput = React.createRef();
        this.episodesInput = React.createRef();
        this.charactersInput = React.createRef();
        this.linesInput = React.createRef();
        this.table = React.createRef();
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
            case 0: this.projectInput.current.focus(); break;
            case 1: this.charactersInput.current.focus(); break;
            case 2: this.episodesInput.current.focus(); break;
            case 3: this.linesInput.current.focus(); break;
            default: console.error('[ERROR] no reference to input field was set'); break;
        }
    }

    setInputRefs(refs = []) {
        if (refs.length !== 0) {
            const [ref_1, ref_2, ref_3, ref_4] = refs;
            this.projectInput = ref_1;
            this.episodesInput = ref_2;
            this.charactersInput = ref_3;
            this.linesInput = ref_4;
        }
    }
    
    // Callback method for components to update project property state
    updateFieldState(key, value) {
        this.setState((s,p) => ({ [key]: value }));
    }

    async offsetPage(offset = 0) {
        // Determine new page number according to input offset
        const next_local_page_requested = (this.state.page + offset <= 0) ? 0 : this.state.page + offset;
        const total_local_page = Math.floor(this.state.result.data[API_RESULT_KEYS.TOTAL_QUERY] / this.state.rows_per_page);
        let next_local_page_state = 0;

        if (next_local_page_requested < 0) {
            next_local_page_state = 0;
        } else if (next_local_page_requested > total_local_page) {
            next_local_page_state = this.state.page;
        } else {
            next_local_page_state = next_local_page_requested;
        }
        
        // Pages for local current results and swap buffer results
        const remote_max_query = this.state.result.data[API_RESULT_KEYS.MAX_QUERY];
        const current_results_page = this.state.result.data[API_RESULT_KEYS.PAGE];
        const current_results_offset = this.state.result.data[API_RESULT_KEYS.OFFSET];
        const swap_results_page = this.state.result_prefetch.data[API_RESULT_KEYS.PAGE];
        const swap_results_offset = this.state.result_prefetch.data[API_RESULT_KEYS.OFFSET];

        // Determine if we've cycled up & down past the mid-way point of the remote page
        const direction_up   = next_local_page_state * this.state.rows_per_page - (current_results_page * remote_max_query) > Math.floor(remote_max_query / 2) && this.state.page > this.state.previous_page;
        const direction_down = next_local_page_state * this.state.rows_per_page - (current_results_page * remote_max_query) < Math.floor(remote_max_query / 2) && this.state.page < this.state.previous_page;

        // Determine if we're swapping buffers
        const ne_current_offset = Math.floor(next_local_page_state * this.state.rows_per_page / remote_max_query) !== current_results_page;
        
        // Create offset value for new pre-fetch query according to specified input offset and within the bounds of min/max pagination values
        const new_offset = (Math.floor(next_local_page_state * this.state.rows_per_page / remote_max_query) + offset <= 0)
            ? 0
            : Math.floor(next_local_page_state * this.state.rows_per_page / remote_max_query) + offset;
        
        // Calculate missing entries from current buffer to fill last page
        const max_mod_pages = Math.floor(remote_max_query % this.state.rows_per_page);
        const total_missing_buffer = this.state.rows_per_page - max_mod_pages + (max_mod_pages * current_results_page);
        if (this.state.result_offset !== total_missing_buffer) this.setState({ result_offset: total_missing_buffer });
        const prefetch_ready = this.state.result_prefetch.data[API_RESULT_KEYS.RESULTS].length > 0;
        const overflow_same = this.state.result_overflow_page === current_results_page;
        // console.log('missing', total_missing_buffer, 'prefetch_ready', prefetch_ready, 'current lt swap', current_results_page <= swap_results_page, 'direction up', direction_up);
        // console.log('current page', current_results_page, 'swap page', swap_results_page);

         // Pre-fetch data for new page
         if (current_results_page >= swap_results_page && direction_up || current_results_page <= swap_results_page && direction_down) {
            console.log('Pre-fetching data from API');
            // TODO: This is no longer being called asyncronously - handle case if pre-fetch failed
            // TODO: Add promise failure callback
            this.lineSearch(false, true, new_offset).then(() => {
                this.setState({
                    result_overflow: this.state.result_prefetch.data[API_RESULT_KEYS.RESULTS].slice(0, this.state.result_offset),
                    result_overflow_page: swap_results_page
                });
            });
        }

        if (total_missing_buffer > 0
            && overflow_same
            && prefetch_ready)
        {
            this.setState({
                result_overflow: this.state.result_prefetch.data[API_RESULT_KEYS.RESULTS].slice(0, total_missing_buffer),
                result_overflow_page: swap_results_page
            });

            // console.log(this.state.result_overflow);
        }

        // Swap buffers if we've reached the end of the current buffer
        if (ne_current_offset) {
            console.log('Swapping results with pre-fetched buffer');
            this.swapResultBuffers();
        }

        // Update page state
        this.updateFieldState('previous_page', this.state.page);
        this.updateFieldState('page', next_local_page_state);
    }

    swapResultBuffers() {
        // Temporarily store current results
        const temp_result = this.state.result;
        const temp_overflow = this.state.result.data[API_RESULT_KEYS.RESULTS].slice(0, this.state.result_offset);
        // const temp_2 = this.state.result_swap;

        this.setState({
            // Set current buffers to prefetch data
            result: this.state.result_prefetch,
            
            // Set prefetch buffers to current results
            result_prefetch: temp_result,

            // Update overflow buffers with new prefetched buffer data
            result_overflow: temp_overflow
        });
    }

    // Callback method for preparing user search inputs and querying database
    async lineSearch(new_query, prefetch = false, page = 0, offset = 0, limit = 0) {
        // TODO: Validate that at least one option was provided by user
        // Storage for parsed user input
        let list_episodes = [];
        let list_projects =   (new_query) ? [] : this.state.current_query_parameters.projects;
        let list_characters = (new_query) ? [] : this.state.current_query_parameters.characters;
        let list_lines =      (new_query) ? [] : this.state.current_query_parameters.lines;
        let eps_sequence =    (new_query) ? [] : this.state.current_query_parameters.episodes;

        // Query hrefs with parameters
        let qry_href = '';
        let qry_page = (new_query) ? 0 : page;
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
        const valid_search = (re_space.test(this.state.projects))
                              && (re_space.test(this.state.characters))
                              && (re_space.test(this.state.episodes))
                              && (re_space.test(this.state.lines));

        // TODO: Test if current user input is the same as previous inputs

        if (new_query && !valid_search) {
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
            eps_sequence = epRangesToSequences(list_episodes);
            
            // Build the URL based on user inputs
            // TODO: Backwards offset for swap buffer query
            qry_href = buildQueryString(list_projects, eps_sequence, list_characters, list_lines, 0, qry_page, qry_offset);

             // Update state for current query parameters
             // Clear current results
            this.setState({
                 page: 0,
                 result: result_default,
                 current_query: qry_href,
                 current_query_parameters: {
                    projects: list_projects,
                    episodes: eps_sequence,
                    characters: list_characters,
                    lines: list_lines,
                    page: qry_page,
                    offset: qry_offset
                 }
            });
        } else {
            // TODO: Backwards offset for swap buffer query
            qry_href = buildQueryString(list_projects, eps_sequence, list_characters, list_lines, 0, qry_page, qry_offset);
        }
        
        // Make query to the API
        try {
            if (!valid_search) console.log('Making call to API with href:', qry_href);
            const qry_response = ((!valid_search)
                ? await api.get(qry_href)
                : { status: 0 }
            );
            
            // TODO: Cancel search if no valid input parameters were passed
            // TODO: Various response validation before setting results
            // TODO: Set UI to loading state for potential long response times from API

            // Check if data is valid and store relevant data in payload
            const qry_data = ((qry_response.status === 200)
                ? qry_response.data
                : result_default.data
            );

            const results = {
                query: qry_href,
                query_params: [list_projects, eps_sequence, list_characters, list_lines, qry_page, qry_offset],
                data: qry_data
            }

            // Set state for results
            // TODO: Manage syncronisation of swap buffers
            if (prefetch) {
                this.setState({result_prefetch: results});
            } else {
                this.setState({result: results});
            }

            if (qry_response.status === 200) this.setState({successful_results: true});
            else this.setState({successful_results: false});
        } catch (e) {
            // TODO: handle failed query in UI
            console.error(`[ERROR] query to API failed with message: ${e}`);
        }
        
    }
    
    // Method for clearing search fields
    clearSearch(clear_results = true) {
        this.setState({
            projects: '',
            characters: '',
            episodes: '',
            lines: '',
            are_fields_empty: true
        });

        if (clear_results) {
            this.setState({
                page: 0,
                result: result_default,
                result_overflow : [],
                result_overflow_page: 0,
                result_offset: 0,
                current_query: '',
                successful_results: false,
                result_prefetch: result_default
            });
        }
    }

    componentDidMount() {
        // Listen for shortcuts
        window.addEventListener('keydown', async (e) => {
            // console.log(e.key);
            // console.log(this.state.btn_last_pressed);
            
            // Get modifier state
            const modifier_key = (window.navigator.platform === 'Win32') ? (e.ctrlKey && e.shiftKey) : e.metaKey;
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
                // TODO: Only clear field for currently focused input field
                this.clearSearch(false);
            }

            // Clear clear search results on 2x Escape
            if (e.key === 'Escape' && this.state.are_fields_empty) {
                this.clearSearch(true);
            }

            // Clear clear search results on 2x Escape
            if (e.key === 'Escape' && this.state.btn_last_pressed === 'Escape') {
                this.projectInput.current.focus();
                this.setState({ current_input_focus: 0 });
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
        });

    }

    componentWillUnmount() {
        window.removeEventListener('keydown', (e) => {
            // TODO
        });
    }

    componentDidUpdate(prev_props, prev_state) {

    }

    render() {
        // Handle background color based on query results
        let backgroundColor = '#4da4f6';
        const are_fields_empty = this.state.projects === ''
                                 && this.state.characters === ''
                                 && this.state.episodes === ''
                                 && this.state.lines === ''
                                 && !this.state.successful_results
                                 && this.state.result.data[API_RESULT_KEYS.TOTAL_QUERY] === 0;

        if (!are_fields_empty && this.state.successful_results && this.state.result.data[API_RESULT_KEYS.TOTAL_QUERY] > 0) backgroundColor = '#007e00';
        else if (!are_fields_empty && this.state.successful_results && this.state.result.data[API_RESULT_KEYS.TOTAL_QUERY] <= 0) backgroundColor = '#ff572d';

        return (
            <div style={{ backgroundColor: backgroundColor }} className='App'>
                <h1 className='header'>AAP Lore</h1>
                <Searchbar
                    updateFieldCallback={this.updateFieldState.bind(this)}
                    setRefCallback={this.setInputRefs.bind(this)}
                    project={this.state.projects}
                    character={this.state.characters}
                    episode={this.state.episodes}
                    line={this.state.lines}
                    page={this.state.page}
                />
                <div className='table-wrapper'>
                    <Table
                        ref={this.table}
                        page={this.state.page}
                        rowsPerPage={this.state.rows_per_page}
                        searchResult={this.state.result}
                        overflowResult={this.state.result_overflow}
                        resultOffset={this.state.result_offset}
                    />
                    <TablePagination
                        className='pagination-bar'
                        results={this.state.result}
                        page={this.state.page}
                        rowsPerPage={this.state.rows_per_page}
                        updatePageCallback={this.offsetPage.bind(this)}
                    />
                </div>
            </div>
        );
    }
}
    