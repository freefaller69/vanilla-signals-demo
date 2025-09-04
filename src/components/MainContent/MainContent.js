import mainHtml from './MainContent.html?raw';
import mainStyles from './MainContent.css?inline';
import '../Chat/Chat.js';
import '../Sidebar/Sidebar.js';
import setShadowStyles from '../../utils/setShadowStyles.js';
import setShadowTemplate from '../../utils/setShadowTemplate.js';
class MainContent extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    this.initialize(shadowRoot, mainHtml, mainStyles);
  }

  connectedCallback() {
    console.log('Main Content connected');
  }

  initialize(root, html, styles) {
    setShadowStyles(root, styles);
    setShadowTemplate(root, html);
  }
}

customElements.define('main-content', MainContent);
