import mainHtml from './MainContent.html?raw';
import mainStyles from './MainContent.css?inline';
import '../Chat/Chat.js';
import '../Sidebar/Sidebar.js';

class MainContent extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });

    const styleSheet = new CSSStyleSheet();
    styleSheet.replaceSync(mainStyles);
    shadowRoot.adoptedStyleSheets = [styleSheet];

    const templateElement = document.createElement('template');
    templateElement.innerHTML = mainHtml;
    shadowRoot.appendChild(templateElement.content.cloneNode(true));
  }

  connectedCallback() {
    console.log('Main Content connected');
  }
}
customElements.define('main-content', MainContent);
