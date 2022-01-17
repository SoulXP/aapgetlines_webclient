import React, { useState } from 'react'
import './OptionsButton.css'
import { API_LOCAL_DEFAULTS } from '../../http/ApiClient.js'

export default function OptionsButton({ currentOptionIndex, optionsList, updateCallback }) {
    return (
        <div className='options-btn-container'>
            <span onClick={(e) => { e.preventDefault(); console.log('changed page display'); updateCallback(currentOptionIndex + 1); }}>{optionsList[currentOptionIndex]}</span>
        </div>
    )
}