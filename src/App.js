import React from 'react';
import './styles.css';
import './App.css';
import Searchbar from './components/searchbar/SearchBar.js';
import { api, API_RESULT_KEYS, API_LOCAL_DEFAULTS } from './http/ApiClient.js';
import Table from './components/resultstable/Table.js';
import buildQueryString from './utils/QueryUrl.js';
import { epRangesToSequences } from './components/searchbar/EpRange.js';
import TablePagination from './components/resultstable/UsePagination';
import OptionsButton from './components/buttons/OptionsButton.js'

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

// TODO: Formalize these functions
function total_rows_table() {
    return Math.floor((window.innerHeight - 288) / 32); // 288 is the total height of all other document elements, 30 is height of each row + border
}

function total_height_table() {
    return Math.floor(total_rows_table() * 27); // 288 is the total height of all other document elements, 30 is height of each row + border
}

function react_element_dimensions(element) {
    let height = -1;
    let width = -1;

    if (element.current !== null) {
        height = element.current.offsetHeight;
        width = element.current.offsetWidth;
    }
    
    return { height, width };
}

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

            // Buffer and control variables for managing results from API
            result: result_default,
            result_overflow: [],
            result_overflow_page: 0,
            result_offset: 0,
            
            // For prefetching data
            result_prefetch: result_default,

            // Loading control variables for API queries
            awaiting_results: false,
            
            // Pagination variables
            page: 0,
            previous_page: 0,
            page_display_selection: 0,
            page_display_options: [total_rows_table(), 50, 125, 250],
            row_dimensions_px: () => {
                if (this.tableBody.current !== null) {
                    if (this.tableBody.current.rows.length > 0) return this.tableBody.current.rows[0].offsetHeight;
                };

                return 0;
            },
            rows_per_page: () => { return this.state.page_display_options[this.state.page_display_selection]; },

            // Key-stroke state
            btn_last_pressed: ''
        };

        // Reset computed CSS properties for table display
        this.refreshTable();

        // References to DOM components
        this.projectsInput = React.createRef();
        this.episodesInput = React.createRef();
        this.charactersInput = React.createRef();
        this.linesInput = React.createRef();
        this.tableBody = React.createRef();
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

    async offsetPage(offset = 0) {
        // Determine new page number according to input offset
        const next_local_page_requested = (this.state.page + offset <= 0) ? 0 : this.state.page + offset;
        const total_local_page = Math.ceil(this.state.result.data[API_RESULT_KEYS.TOTAL_QUERY] / this.state.rows_per_page());
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
        const swap_results_page = this.state.result_prefetch.data[API_RESULT_KEYS.PAGE];

        // Determine if we've cycled up & down past the mid-way point of the remote page
        const direction_up   = next_local_page_state * this.state.rows_per_page() - (current_results_page * remote_max_query) > Math.floor(remote_max_query / 2) && this.state.page > this.state.previous_page;
        const direction_down = next_local_page_state * this.state.rows_per_page() - (current_results_page * remote_max_query) < Math.floor(remote_max_query / 2) && this.state.page < this.state.previous_page;

        // Determine if we're swapping buffers
        const ne_current_offset = Math.floor(next_local_page_state * this.state.rows_per_page() / remote_max_query) !== current_results_page;
        
        // Create offset value for new pre-fetch query according to specified input offset and within the bounds of min/max pagination values
        const new_offset = (Math.floor(next_local_page_state * this.state.rows_per_page() / remote_max_query) + offset <= 0)
            ? 0
            : Math.floor(next_local_page_state * this.state.rows_per_page() / remote_max_query) + offset;
        
        // Calculate missing entries from current buffer to fill last page
        const max_mod_pages = Math.floor(remote_max_query % this.state.rows_per_page());
        const total_missing_buffer = this.state.rows_per_page() - max_mod_pages + (max_mod_pages * current_results_page);

        if (this.state.result_offset !== total_missing_buffer) this.setState({ result_offset: total_missing_buffer });

         // Pre-fetch data for new page and fill overflow buffer
         if (current_results_page >= swap_results_page && direction_up || current_results_page <= swap_results_page && direction_down && (current_results_page !== 0 && swap_results_page !== 0)) {
            console.log('Pre-fetching data from API');
            console.log('current page', current_results_page,'swap page', swap_results_page)
            // TODO: This is no longer being called asyncronously - handle case if pre-fetch failed
            // TODO: Add promise failure callback
            this.lineSearch(false, true, new_offset).then(() => {
                this.setState({
                    result_overflow: this.state.result_prefetch.data[API_RESULT_KEYS.RESULTS].slice(0, this.state.result_offset),
                    result_overflow_page: swap_results_page
                });
            });
        }

        // Fill overflow buffer when empty and prefetch data is available
        const prefetch_ready = this.state.result_prefetch.data[API_RESULT_KEYS.RESULTS].length > 0;
        const overflow_same = this.state.result_overflow_page === current_results_page;

        if (total_missing_buffer > 0
            && overflow_same
            && prefetch_ready)
        {
            this.setState({
                result_overflow: this.state.result_prefetch.data[API_RESULT_KEYS.RESULTS].slice(0, total_missing_buffer),
                result_overflow_page: swap_results_page
            });
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

    async updateBuffers() {
        console.log('awaiting results', this.state.awaiting_results);
        if (!this.state.awaiting_results) {
            // Current page information
            const current_remote_page = this.state.result.data[API_RESULT_KEYS.PAGE];
            const current_swap_remote_page = this.state.result_prefetch.data[API_RESULT_KEYS.PAGE];
            const required_remote_page = Math.floor(this.state.page * this.state.rows_per_page() / this.state.result.data[API_RESULT_KEYS.MAX_QUERY]);
    
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
                const closest_swap_page = (this.state.page * this.state.rows_per_page() - (this.state.result.data[API_RESULT_KEYS.PAGE] * this.state.result.data[API_RESULT_KEYS.MAX_QUERY]) >= Math.floor(this.state.result.data[API_RESULT_KEYS.MAX_QUERY] / 2))
                ? Math.min(Math.ceil(this.state.result.data[API_RESULT_KEYS.MAX_QUERY] / this.state.rows_per_page()), this.state.result.data[API_RESULT_KEYS.PAGE] + 1)
                : Math.max(0, this.state.result.data[API_RESULT_KEYS.PAGE] - 1);
            
                const ne_required_swap_page = Math.floor(this.state.page * this.state.rows_per_page() / this.state.result_prefetch.data[API_RESULT_KEYS.MAX_QUERY]) !== this.state.result_prefetch.data[API_RESULT_KEYS.PAGE];
                if (ne_required_swap_page) {
                    console.log('new swap page', closest_swap_page);
                    await this.lineSearch(false, true, closest_swap_page);
                }

                // Update overflow buffer with new swap buffer
                const max_mod_pages = Math.floor(this.state.result.data[API_RESULT_KEYS.MAX_QUERY] % this.state.rows_per_page());
                const total_missing_buffer = this.state.rows_per_page() - max_mod_pages + (max_mod_pages * this.state.result.data[API_RESULT_KEYS.PAGE]);

                if (total_missing_buffer > 0) {
                    this.setState({
                        result_overflow: this.state.result_prefetch.data[API_RESULT_KEYS.RESULTS].slice(0, total_missing_buffer),
                        result_overflow_page: this.state.result_prefetch.data[API_RESULT_KEYS.PAGE]
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
            result: this.state.result_prefetch,
            
            // Set prefetch buffers to current results
            result_prefetch: temp_result
        });
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
        const valid_search = (re_space.test(this.state.projects))
                              && (re_space.test(this.state.characters))
                              && (re_space.test(this.state.episodes))
                              && (re_space.test(this.state.lines));

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
            qry_href = buildQueryString(list_projects, eps_sequence, list_characters, list_lines, 0, qry_page, qry_offset);
        }
        
        // Make query to the API
        try {
            // Set flag for pending results from API if current buffer is empty
            // console.log('load state', this.state.result.data[API_RESULT_KEYS.RESULTS].length <= 0 && !prefetch);
            if (this.state.result.data[API_RESULT_KEYS.RESULTS].length <= 0 && !prefetch) this.setState({ awaiting_results: true });

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
                result_prefetch: result_default,
                awaiting_results: false
            });
        }
    }

    refreshTable() {
        document.documentElement.style.setProperty('--table-max-size', `${total_height_table()}px`);
        document.documentElement.style.setProperty('--table-data-max-size', `${total_height_table() - 88}px`);
    }

    componentDidMount() {
        // Listen for shortcuts
        window.addEventListener('keydown', async (e) => {
            // console.log(e.key);
            // console.log(this.state.btn_last_pressed);
            
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
        });

        // Window resizing event listener
        window.addEventListener('resize', (e) => {
            if (this.state.rows_per_page() !== total_rows_table()) {
                // Handle total row change
                const updated_options = this.state.page_display_options.map((c, i) => {
                    if (i === 0) return total_rows_table();
                    else return c;
                });
                this.setState({ page_display_options: updated_options });

                // Handle new last page
                if (this.state.page >= Math.ceil(this.state.result.data[API_RESULT_KEYS.TOTAL_QUERY] / this.state.rows_per_page()) - 1) {
                    this.setState({
                        page: Math.ceil(this.state.result.data[API_RESULT_KEYS.TOTAL_QUERY] / this.state.rows_per_page()) - 1,
                        previous_page: Math.ceil(this.state.result.data[API_RESULT_KEYS.TOTAL_QUERY] / this.state.rows_per_page()) - 2
                    });
                }

                // Handle data in buffers according to new page sizing
                this.updateBuffers();
            }

            // Reset computed CSS properties for table display
            this.refreshTable();
        });
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
                    updateFieldCallbacks={{
                            updateProjects:   (v) => { this.updateFieldState('projects', v);            },
                            updateEpisodes:   (v) => { this.updateFieldState('episodes', v);            },
                            updateCharacters: (v) => { this.updateFieldState('characters', v);          },
                            updateLines:      (v) => { this.updateFieldState('lines', v);               },
                            updateInputFocus: (v) => { this.updateFieldState('current_input_focus', v); },
                        }
                    }
                    setRefCallbacks={{
                        updateProjectsField:   (v) => { this.setAppRefs([{projectsInput: v}])   },
                        updateEpisodesField:   (v) => { this.setAppRefs([{episodesInput: v}])   },
                        updateCharactersField: (v) => { this.setAppRefs([{charactersInput: v}]) },
                        updateLinesField:      (v) => { this.setAppRefs([{linesInput: v}])      },
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
                        rowsPerPage={this.state.rows_per_page()}
                        searchResult={this.state.result}
                        overflowResult={this.state.result_overflow}
                        resultOffset={this.state.result_offset}
                        loadingState={this.state.awaiting_results}
                        setRefCallback={(ref) => { this.setAppRefs([{ 'tableBody': ref }]); }}
                    />
                    <div className='table-nav-container'>
                        <OptionsButton
                            currentOptionIndex={this.state.page_display_selection}
                            optionsList={this.state.page_display_options}
                            displayValue={(index, value) => (index > 0) ? `Display: ${value}` : 'Display: Fit' }
                            updateCallback={(value) => { if (value >= this.state.page_display_options.length) value = 0; this.updateFieldState('page_display_selection', value); this.refreshTable(); }}
                        />
                        <TablePagination
                            className='pagination-bar'
                            results={this.state.result}
                            page={this.state.page}
                            rowsPerPage={this.state.rows_per_page()}
                            updatePageCallback={(v) => { this.offsetPage(v); }}
                        />
                        <div style={{ marginRight: '3em', visibility: 'hidden' }}>{this.state.rows_per_page()}</div>
                    </div>
                </div>
            </div>
        );
    }
}
