import mainHtml from './MainContent.html?raw';
import mainStyles from './MainContent.css?inline';
import { setupComponent } from '../../utils/createComponent.js';
import '../Chat/Chat.js';
import '../Sidebar/Sidebar.js';
class MainContent extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    setupComponent(shadowRoot, mainStyles, mainHtml, 'shadow');
  }

  connectedCallback() {
    console.log('Main Content connected');
  }
}

customElements.define('main-content', MainContent);
