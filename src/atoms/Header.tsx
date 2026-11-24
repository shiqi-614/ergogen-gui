import {ReactNode} from "react";
import styled from "styled-components";

const HeaderContainer = styled.div`
      width: 100%;
      height: 4em;
      /* the page is a column as tall as the window: the header keeps its height, whatever is below it */
      flex: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1rem 0 1rem;
      gap: 1rem;
`;

// what the page puts in the header's left, where the app's name was (the example menu)
const Tools = styled.div`
      flex: none;
`;

const LinkContainer = styled.div`
      a {
        color: white;
        text-decoration: none;
        display: inline-block;
        margin-right: 2em
      }
      a:last-of-type{
        margin-right: 0;
      }
    `;



const Header = ({children}: {children?: ReactNode}): JSX.Element => {
    return (
        <HeaderContainer>
            <Tools>{children ?? <h2>Ergogen</h2>}</Tools>

            <LinkContainer>
                {/*<a href="#" rel="noreferrer">*/}
                {/* TODO add intro modal */}
                {/*    Intro*/}
                {/*</a>*/}
                <a href="https://docs.ergogen.xyz/" target="_blank" rel="noreferrer">
                    Docs
                </a>
            </LinkContainer>
        </HeaderContainer>
    );
}

export default Header;