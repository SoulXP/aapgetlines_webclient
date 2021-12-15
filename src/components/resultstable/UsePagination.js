import React, { useState } from "react";
import { IconButton } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { ArrowForward, ArrowBack } from '@mui/icons-material'
import { red } from "@mui/material/colors";
import { API_QRY_PARAMETERS, API_RESULT_KEYS } from "../../http/ApiClient";
import './UsePagination.css'

export default function TablePagination({results, page, rowsPerPage, updatePageCallback}) {
    // Extract stateful variables
    const total_results = results.data[API_RESULT_KEYS.TOTAL_QUERY];
    const chunk = results.data[API_RESULT_KEYS.OFFSET];
    const chunk_size = results.data[API_RESULT_KEYS.MAX_QUERY];
    const query = results.qry_href;

    // Variables for UI display
    const total_page = Math.floor(total_results / rowsPerPage);

    // Build themes for buttons
    const btn_theme = createTheme({
        palette: {
            primary: red,
          }
    });

    // Determine what to display for page information
    const display_pages = total_results > 0;
    let display = (<span className='normal-text'>No Results</span>);

    if (total_results > 0) {
        display = (<>
            <span>Page {page + 1} of {total_page + 1}</span>
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