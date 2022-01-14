import React from "react";
import { IconButton } from "@mui/material";
import { ArrowForward, ArrowBack } from '@mui/icons-material'
import { API_RESULT_KEYS } from "../../http/ApiClient";
import './UsePagination.css'

export default function TablePagination({results, page, rowsPerPage, updatePageCallback}) {
    // Extract stateful variables
    const total_results = results.data[API_RESULT_KEYS.TOTAL_QUERY];

    // Variables for UI display
    const total_page = Math.ceil(total_results / rowsPerPage);
    let display = (<span className='normal-text'>No Results</span>);

    if (total_results > 0) {
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