import styled from "styled-components";


const FooterContainer = styled.div`
      display: flex;
      height: 3rem;
      width: 100%;
      align-items: center;
      justify-content: space-between;
      padding: 0 1rem 0.5rem 1rem;
      margin-top: auto;
      color: #FFFFFF;

      a {
        color: #28a745;
        text-decoration: none;
        
        &:hover {
          color: #FFF;
        }
      }
`;

const Footer = (): JSX.Element => {
    return (
        <FooterContainer>
        </FooterContainer>
    );
}

export default Footer;
