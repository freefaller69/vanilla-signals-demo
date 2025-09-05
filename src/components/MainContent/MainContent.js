import mainHtml from './MainContent.html?raw';
import mainStyles from './MainContent.css?inline';
import { setupComponent } from '../../utilities/createComponent.js';
import '../Chat/Chat.js';
import '../Sidebar/Sidebar.js';
import { startRandomMovieQuotes } from '../../store/messageStore.js';
class MainContent extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    setupComponent(shadowRoot, mainStyles, mainHtml);
  }

  connectedCallback() {
    console.log('Main Content connected');
    startRandomMovieQuotes();
  }
}

customElements.define('main-content', MainContent);
