import React from 'react';
import './styles.css';
import './App.css';
import Searchbar from './components/searchbar/SearchBar.js';
import { api, API_RESULT_KEYS, API_LOCAL_DEFAULTS } from './http/ApiClient.js';
import Table from './components/resultstable/Table.js';
import buildQueryString from './utils/QueryUrl.js';
import { epRangesToSequences } from './components/searchbar/EpRange.js';
import TablePagination from './components/resultstable/UsePagination';

const result_default = {
    query: '',
    query_params: [],
    data: {
        [API_RESULT_KEYS.TOTAL_QUERY]:   0,
        [API_RESULT_KEYS.TOTAL_RESULTS]: 0,
        [API_RESULT_KEYS.MAX_QUERY]:     API_LOCAL_DEFAULTS.MAX_QUERY,
        [API_RESULT_KEYS.OFFSET]:        0,
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
                offset: 0
            },
            result: result_default,
            result_next: result_default,

            // For prefetching data
            prefetch_ready: false,
            result_prefetch_1: result_default,
            result_prefetch_2: result_default,

            // Pagination variables
            page: 0,
            // rows_per_page: 10,
            rows_per_page: Math.floor((0.84 * window.screen.height) / 40), // 84% is a magic number for now
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
    
    // Callback method for components to update project property tate
    updateFieldState(key, value) {
        this.setState((s,p) => ({ [key]: value }));
    }

    async offsetPage(offset = 0) {
        // Determine what new page number should be
        const next_page = (this.state.page + offset <= 0) ? 0 : this.state.page + offset;
        const prefetch_offset = (offset >= 0) ? 1 : -1;
        const total_page = Math.floor(this.state.result.data[API_RESULT_KEYS.TOTAL_QUERY] / this.state.rows_per_page);
        let update_page = 0;

        if (next_page < 0) {
            update_page = 0;
        } else if (next_page > total_page) {
            update_page = this.state.page;
        } else {
            update_page = next_page;
        }

        // Determine if new data must be fetched from API
        // TODO: Global constant for data buffers
        const max_query = this.state.result.data[API_RESULT_KEYS.MAX_QUERY];
        const current_offset = this.state.result.data[API_RESULT_KEYS.OFFSET];
        const gt_max_query = Math.floor(next_page * this.state.rows_per_page) - (current_offset * max_query) >= max_query * 2;
        const ne_current_offset = Math.floor(next_page * this.state.rows_per_page / max_query) !== current_offset;
        const new_search = ne_current_offset || gt_max_query;

        // Set new offset if new data is required
        const new_offset = (new_search) ? Math.floor(next_page * this.state.rows_per_page / max_query) : -1;
        console.log(this.state.prefetch_ready, 'next page', next_page, 'new offset', new_offset);
        
        // Invoke callbacks with new pagination parameters
        if (new_offset > -1 && !this.state.prefetch_ready) {
            console.log('Pre-fetching data from API');
            await this.lineSearch(false, true, new_offset + prefetch_offset);
        } else if (this.state.prefetch_ready && gt_max_query) {
            console.log('Swapping buffers with pre-fetched data');
            this.swapResultBuffers();
        }

        this.updateFieldState('page', update_page);
    }

    swapResultBuffers() {
        // Temporarily store current results
        // const temp_1 = this.state.result;
        // const temp_2 = this.state.result_swap;

        this.setState({
            // Set current buffers to prefetch data
            result: this.state.result_prefetch_1,
            result_next: this.state.result_prefetch_2,

            // Set prefetch buffers to default and update prefetch status
            prefetch_ready: false,
            result_prefetch_1: result_default,
            result_prefetch_2: result_default
        });
    }

    // Callback method for preparing user search inputs and querying database
    async lineSearch(new_query, prefetch = false, offset = 0) {
        // TODO: Validate that at least one option was provided by user
        // Storage for parsed user input
        let list_episodes = [];
        let list_projects = (new_query) ? [] : this.state.current_query_parameters.projects;
        let list_characters = (new_query) ? [] : this.state.current_query_parameters.characters;
        let list_lines = (new_query) ? [] : this.state.current_query_parameters.lines;
        let eps_sequence = (new_query) ? [] : this.state.current_query_parameters.episodes;

        // Query hrefs with parameters
        // TODO: Backwards offset for swap buffer query
        let qry_href = '';
        let qry_offset = (new_query) ? 0 : offset;
        let qry_href_swap = '';
        let qry_offset_swap = (new_query) ? 1 : offset + 1;

        // Condition for filling swap buffer
        let fill_swap = false;
        
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
            qry_href = buildQueryString(list_projects, eps_sequence, list_characters, list_lines, qry_offset);
            qry_href_swap = buildQueryString(list_projects, eps_sequence, list_characters, list_lines, qry_offset_swap);

             // Update state for current query parameters
             // Clear current results
            this.setState({
                 page: 0,
                 result: result_default,
                 result_next: result_default,
                 current_query: qry_href,
                 current_query_parameters: {
                    projects: list_projects,
                    episodes: eps_sequence,
                    characters: list_characters,
                    lines: list_lines,
                    offset: qry_offset
                 }
            });
        } else {
            // TODO: Backwards offset for swap buffer query
            qry_href = buildQueryString(list_projects, eps_sequence, list_characters, list_lines, qry_offset);
            qry_href_swap = buildQueryString(list_projects, eps_sequence, list_characters, list_lines, qry_offset_swap);
        }
        
        // Make query to the API
        try {
            if (!valid_search) console.log('Making call to API with href:', qry_href);
            const qry_response = ((!valid_search)
            ? await api.get(qry_href)
            : { status: 0 }
            );
            
            // TODO: Conditions for filling buffer when necessary
            if (!valid_search) console.log('Making call to API with href:', qry_href_swap);
            const qry_response_swap = ((!valid_search)
                ? await api.get(qry_href_swap)
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

            const qry_data_swap = ((qry_response_swap.status === 200)
                ? qry_response_swap.data
                : result_default.data
            );

            const results = {
                query: qry_href,
                query_params: [list_projects, eps_sequence, list_characters, list_lines, qry_offset],
                data: qry_data
            }

            const results_swap = {
                query: qry_href_swap,
                query_params: [list_projects, eps_sequence, list_characters, list_lines, qry_offset_swap],
                data: qry_data_swap
            }

            // Set state for results
            // TODO: Manage syncronisation of swap buffers
            if (!prefetch) {
                this.setState({result: results, result_next: results_swap});
            } else {
                this.setState({prefetch_ready: true, result_prefetch_1: results, result_prefetch_2: results_swap});
            }

            if (qry_response.status === 200 && qry_response_swap.status === 200) this.setState({successful_results: true});
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
                result_next: result_default,
                current_query: '',
                successful_results: false,
                prefetch_ready: false,
                result_prefetch_1: result_default,
                result_prefetch_2: result_default
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
                        searchResultSwap={this.state.result_next}
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
    