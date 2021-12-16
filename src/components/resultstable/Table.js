import React from 'react';
import './Table.css';
import { API_RESULT_KEYS } from '../../http/ApiClient.js';
import { float_to_tc } from '../../utils/Timecode.js';

export default function Table({ page, rowsPerPage, searchResult, searchResultSwap }) {
    // Extract search result data
    const results = searchResult.data[API_RESULT_KEYS.RESULTS];
    const results_swap = searchResultSwap.data[API_RESULT_KEYS.RESULTS];
    const all_results = results.concat(results_swap);
    const max_query_results = searchResult.data[API_RESULT_KEYS.MAX_QUERY];
    const query_offset = searchResult.data[API_RESULT_KEYS.OFFSET];

    // Set start and end indexes for results list based on page number and position in current results chunk
    // TODO: Set UI to loading state for potentially long callback queries
    const index_start = (page * rowsPerPage) - (query_offset * max_query_results);
    const index_end = index_start + rowsPerPage;
    console.log('query offset', (query_offset * max_query_results), 'length', all_results.length, 'page', page, 'rows', rowsPerPage, 'start', index_start, 'end', index_end);
    
    // Check if searchResults are valid and parse results
    const table_data = all_results.slice(index_start, index_end).map((found, index) => {
        // Convert timecode ticks to SMPTE frame timecode
        const tc_in = float_to_tc(found[API_RESULT_KEYS.TIMECODE][0], found[API_RESULT_KEYS.FRAME_RATE], found[API_RESULT_KEYS.TICK_RATE]);
        const tc_out = float_to_tc(found[API_RESULT_KEYS.TIMECODE][1], found[API_RESULT_KEYS.FRAME_RATE], found[API_RESULT_KEYS.TICK_RATE]);
        const tc_length = float_to_tc((found[API_RESULT_KEYS.TIMECODE][1] - found[API_RESULT_KEYS.TIMECODE][0]), found[API_RESULT_KEYS.FRAME_RATE], found[API_RESULT_KEYS.TICK_RATE]);
        
        return (
            <tr key={index} className='result-row'>
                <td className='result-row-single'>
                    <div className='row-single-content-nowrap'>{found[API_RESULT_KEYS.PROJECT]}</div>
                </td>
                <td className='result-row-single'>
                    <div className='row-single-content'>{found[API_RESULT_KEYS.SEGMENT]}</div>
                </td>
                <td className='result-row-single'>
                    <div className='row-single-content-nowrap'>{found[API_RESULT_KEYS.CHARACTER]}</div>
                </td>
                <td className='result-row-single'>
                    <div className='row-single-content'>{tc_in}</div>
                </td>
                <td className='result-row-single'>
                    <div className='row-single-content'>{tc_out}</div>
                </td>
                <td className='result-row-single'>
                    <div className='row-single-content'>{tc_length}</div>
                </td>
                <td className='result-row-single-long'>
                    <div className='row-single-content-nowrap'>{found[API_RESULT_KEYS.LINE]}</div>
                </td>
            </tr>
        );
    });
    
    return (
        <div className='table'>
            <table>
                <thead className='table-headers'>
                    <tr className='table-headers-row'>
                        <th>Project</th>
                        <th>Episode</th>
                        <th>Character</th>
                        <th>TC In</th>
                        <th>TC Out</th>
                        <th>Length</th>
                        <th style={{ width: '66%' }}>Line</th>
                    </tr>
                </thead>
                <tbody className='table-text'>
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
        