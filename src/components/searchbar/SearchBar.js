import React, { useRef } from 'react';
import './SearchBar.css';

export default function Searchbar({ searchCallback, clearCallback, updateFieldCallback, setRefCallback, project, character, episode, line }) {
    // TODO: implement input tokenization for user input during search query

    // Create references to input fields for DOM control of cursor
    const projects_field = useRef(null);
    const episodes_field = useRef(null);
    const characters_field = useRef(null);
    const lines_field = useRef(null);
    setRefCallback([projects_field, episodes_field, characters_field, lines_field]);

    return (
        <div className='search-bar'>
            <form className='search-form'>
                    <div className='input-fields'>
                        <input
                            ref={projects_field}
                            onFocus={(e) => { updateFieldCallback('current_input_focus', 0); }}
                            placeholder='Projects'
                            onChange={(e) => { e.preventDefault(); updateFieldCallback('projects', e.target.value); }}
                            className='search-input left-grow-input'
                            value={project}
                        />
                        <input
                            ref={characters_field}
                            onFocus={(e) => { updateFieldCallback('current_input_focus', 1); }}
                            placeholder='Characters'
                            onChange={(e) => { e.preventDefault(); updateFieldCallback('characters', e.target.value); }}
                            className='search-input right-grow-input left-grow-input'
                            value={character}
                        />
                        <input
                            ref={episodes_field}
                            onFocus={(e) => { updateFieldCallback('current_input_focus', 2); }}
                            placeholder='Episodes'
                            onChange={(e) => { e.preventDefault(); updateFieldCallback('episodes', e.target.value); }}
                            className='search-input right-grow-input left-grow-input'
                            value={episode}
                        />
                        <input
                            ref={lines_field}
                            onFocus={(e) => { updateFieldCallback('current_input_focus', 3); }}
                            placeholder='Lines'
                            onChange={(e) => { e.preventDefault(); updateFieldCallback('lines', e.target.value); }}
                            className='search-input left-grow-input'
                            value={line}
                        />
                    </div>
            </form>
        </div>
    );
}
