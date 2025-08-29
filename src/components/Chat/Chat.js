import chatHtml from './Chat.html?raw';
import chatStyles from './Chat.css?inline';

class ChatComponent extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });

    const styleSheet = new CSSStyleSheet();
    styleSheet.replaceSync(chatStyles);
    shadowRoot.adoptedStyleSheets = [styleSheet];

    const templateElement = document.createElement('template');
    templateElement.innerHTML = chatHtml;
    shadowRoot.appendChild(templateElement.content.cloneNode(true));
  }

  connectedCallback() {
    console.log('Chat component connected');
  }
}
customElements.define('chat-component', ChatComponent);
