import React, { useRef } from 'react';
import './Table.css';
import { API_RESULT_KEYS } from '../../http/ApiClient.js';
import { IconButton } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { float_to_tc } from '../../utils/Timecode.js';

export default function Table({ page, rowsPerPage, searchResult, overflowResult, resultOffset, loadingState, setRefCallbacks }) {
    // Declare references for syncing DOM elements with app and destructure callbacks
    const table_head = useRef(null);
    const table_body = useRef(null);
    const { updateTableHeadRef, updateTableBodyRef } = setRefCallbacks;
    updateTableHeadRef(table_head);
    updateTableBodyRef(table_body);

    // Extract search result data
    const results = searchResult;
    // const results = (overflowResult.length > 0)
    //     ? [...searchResult.data[API_RESULT_KEYS.RESULTS], ...overflowResult]
    //     : [...searchResult.data[API_RESULT_KEYS.RESULTS]];

    // Get API search query page info
    // const max_query_results = searchResult.data[API_RESULT_KEYS.MAX_QUERY];
    // const query_page = searchResult.data[API_RESULT_KEYS.PAGE];

    // Set start and end indexes for results list based on page number and position in current results chunk
    // TODO: Set UI to loading state for potentially long callback queries
    // const offset_delta = (page * rowsPerPage) - (query_page * max_query_results);
    // const index_start = (offset_delta < 0) ? resultOffset : offset_delta;
    // const index_end = (index_start + rowsPerPage >= results.length) ? results.length : index_start + rowsPerPage;
    
    // Check if searchResults are valid and parse results
    const table_data = results.map((found, index) => {
        // Convert timecode ticks to SMPTE frame timecode
        const tc_in = float_to_tc(found[API_RESULT_KEYS.TIMECODE][0], found[API_RESULT_KEYS.FRAME_RATE], found[API_RESULT_KEYS.TICK_RATE]);
        const tc_out = float_to_tc(found[API_RESULT_KEYS.TIMECODE][1], found[API_RESULT_KEYS.FRAME_RATE], found[API_RESULT_KEYS.TICK_RATE]);
        const tc_length = float_to_tc((found[API_RESULT_KEYS.TIMECODE][1] - found[API_RESULT_KEYS.TIMECODE][0]), found[API_RESULT_KEYS.FRAME_RATE], found[API_RESULT_KEYS.TICK_RATE]);

        return (
            <tr key={index} className='result-row-height result-row'>
                <td>
                    <div className='row-single-content-nowrap'>{index}</div>
                </td>
                <td>
                    <div className='row-single-content-nowrap'>{found[API_RESULT_KEYS.PROJECT]}</div>
                </td>
                <td>
                    <div className='row-single-content'>{found[API_RESULT_KEYS.SEGMENT]}</div>
                </td>
                <td>
                    <div className='row-single-content-nowrap'>{found[API_RESULT_KEYS.CHARACTER]}</div>
                </td>
                <td>
                    <div className='row-single-content'>{tc_in}</div>
                </td>
                <td>
                    <div className='row-single-content'>{tc_out}</div>
                </td>
                <td>
                    <div className='row-single-content'>{tc_length}</div>
                </td>
                <td>
                    <div className='row-single-content-nowrap'>{found[API_RESULT_KEYS.LINE]}</div>
                </td>
            </tr>
        );
    });
    
    return (
        <div className='table-container'>
            <table style={{ borderCollapse: 'collapse' }}>
                <thead ref={table_head} className='table-headers'>
                    <tr className='table-headers-row'>
                        <th><span>No.</span><IconButton variant='outlined' size='small' disableRipple={true}><ArrowDropDownIcon/></IconButton></th>
                        <th><span>Project</span><IconButton variant='outlined' size='small' disableRipple={true}><ArrowDropDownIcon/></IconButton></th>
                        <th><span>Episode</span><IconButton variant='outlined' size='small' disableRipple={true}><ArrowDropDownIcon/></IconButton></th>
                        <th><span>Character</span><IconButton variant='outlined' size='small' disableRipple={true}><ArrowDropDownIcon/></IconButton></th>
                        <th><span>TC In</span><IconButton variant='outlined' size='small' disableRipple={true}><ArrowDropDownIcon/></IconButton></th>
                        <th><span>TC Out</span><IconButton variant='outlined' size='small' disableRipple={true}><ArrowDropDownIcon/></IconButton></th>
                        <th><span>Length</span><IconButton variant='outlined' size='small' disableRipple={true}><ArrowDropDownIcon/></IconButton></th>
                        <th style={{ width: '66%' }}><span>Line</span><IconButton variant='outlined' size='small' disableRipple={true}><ArrowDropDownIcon/></IconButton></th>
                    </tr>
                </thead>
                <tbody ref={table_body} className='table-text'>
                    {
                        table_data.length > 0
                        &&
                        table_data
                    }
                </tbody>
            </table>
        </div>
    );
}
        