import "./styles.css";
import Searchbar from "./components/searchbar/Searchbar";
import "./App.css";
import React from 'react';
import { api } from './http/apiClient';

export default function App() {
  return (
    <div className="App">
      <div className="header">
        <h1>AAP Get Lines</h1>
      </div>
      <Searchbar />
    </div>
  );
}
