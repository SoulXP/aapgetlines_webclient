import React, { useRef } from 'react';
import './SearchBar.css';

export default function Searchbar({ updateFieldCallbacks, setRefCallbacks, project, character, episode, line }) {
    // TODO: implement input tokenization for user input during search query

    // Create references to input fields for DOM control of cursor
    const projects_field = useRef(null);
    const episodes_field = useRef(null);
    const characters_field = useRef(null);
    const lines_field = useRef(null);

    // Destructure callbacks for updating DOM references in component to app
    const { updateProjectsField, updateEpisodesField, updateCharactersField, updateLinesField } = setRefCallbacks;
    updateProjectsField(projects_field);
    updateEpisodesField(episodes_field);
    updateCharactersField(characters_field);
    updateLinesField(lines_field);

    // Destructure callbacks for updating app state
    const { updateCharacters, updateProjects, updateLines, updateEpisodes, updateInputFocus } = updateFieldCallbacks;

    return (
        <div className='search-bar'>
            <form className='search-form'>
                    <div className='input-fields'>
                        <input
                            ref={projects_field}
                            onFocus={(e) => { updateInputFocus(0); }}
                            placeholder='Projects'
                            onChange={(e) => { e.preventDefault(); updateProjects(e.target.value); }}
                            className='search-input left-grow-input'
                            value={project}
                        />
                        <input
                            ref={characters_field}
                            onFocus={(e) => { updateInputFocus(1); }}
                            placeholder='Characters'
                            onChange={(e) => { e.preventDefault(); updateCharacters(e.target.value); }}
                            className='search-input right-grow-input left-grow-input'
                            value={character}
                        />
                        <input
                            ref={episodes_field}
                            onFocus={(e) => { updateInputFocus(2); }}
                            placeholder='Episodes'
                            onChange={(e) => { e.preventDefault(); updateEpisodes(e.target.value); }}
                            className='search-input right-grow-input left-grow-input'
                            value={episode}
                        />
                        <input
                            ref={lines_field}
                            onFocus={(e) => { updateInputFocus(3); }}
                            placeholder='Lines'
                            onChange={(e) => { e.preventDefault(); updateLines(e.target.value); }}
                            className='search-input left-grow-input'
                            value={line}
                        />
                    </div>
            </form>
        </div>
    );
}
