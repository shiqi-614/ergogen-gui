import React from 'react';
import ReactDOM from 'react-dom';
import styled from "styled-components";
import './index.css';

import Ergogen from './Ergogen';
import ConfigContextProvider from "./context/ConfigContext";
import Absolem from "./examples/absolem";

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  color: #FFFFFF;
  height: 100%;
  width: 100%;
`;

ReactDOM.render(
  <React.StrictMode>
      <>
          <AppContainer>
              <ConfigContextProvider initialInput={Absolem.value}>
                <Ergogen />
              </ConfigContextProvider>
          </AppContainer>
      </>
  </React.StrictMode>,
  document.getElementById('root')
);