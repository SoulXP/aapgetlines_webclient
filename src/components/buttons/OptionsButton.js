import React, { useState } from 'react'
import './OptionsButton.css'

export default function OptionsButton({ currentOptionIndex, optionsList, displayValue, updateCallback }) {
    return (
        <div className='options-btn-container'>
            <span onClick={(e) => { e.preventDefault(); console.log('changed page display'); updateCallback(currentOptionIndex + 1); }}>{displayValue(currentOptionIndex, optionsList[currentOptionIndex])}</span>
        </div>
    )
}