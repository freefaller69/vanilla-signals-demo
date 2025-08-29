import sidebarHtml from './Sidebar.html?raw';
import sidebarStyles from './Sidebar.css?inline';

class SidebarComponent extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });

    const styleSheet = new CSSStyleSheet();
    styleSheet.replaceSync(sidebarStyles);
    shadowRoot.adoptedStyleSheets = [styleSheet];

    const templateElement = document.createElement('template');
    templateElement.innerHTML = sidebarHtml;
    shadowRoot.appendChild(templateElement.content.cloneNode(true));
  }

  connectedCallback() {
    console.log('Sidebar component connected');
  }
}
customElements.define('sidebar-component', SidebarComponent);
