import React, { useState } from 'react'
import './OptionsButton.css'

export default function OptionsButton({ currentOptionIndex, optionsList, displayValue, updateCallback }) {
    return (
        <div className='options-btn-container'>
            <span onClick={(e) => { e.preventDefault(); updateCallback(currentOptionIndex + 1); }}>{displayValue(currentOptionIndex, optionsList[currentOptionIndex])}</span>
        </div>
    )
}
