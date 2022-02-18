import React from "react";
import { IconButton } from "@mui/material";
import { ArrowForward, ArrowBack } from '@mui/icons-material'
import './TablePagination.css'

export default function TablePagination({totalResults, page, rowsPerPage, updatePageCallback, refreshTableCallback}) {
    // Extract stateful variables
    // const total_results = results.data[API_RESULT_KEYS.TOTAL_QUERY];

    // Variables for UI display
    const total_page = Math.ceil(totalResults / rowsPerPage);
    let display = (<span className='normal-text'>No Results</span>);

    // Update table
    refreshTableCallback();

    if (totalResults > 0) {
        display = (<>
            <span>Page {page + 1} of {total_page}</span>
            <br/>
            <IconButton variant='outlined' onClick={(e) => { e.preventDefault(); updatePageCallback(-1); }}><ArrowBack/></IconButton>
            <IconButton variant='outlined' onClick={(e) => { e.preventDefault(); updatePageCallback(1); }}><ArrowForward/></IconButton>
        </>);
    }

    return (
        <div className='page-navigator normal-text'>
            {display}
        </div>
    );
}
