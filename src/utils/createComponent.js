export function createComponent(styles, html, domType = 'shadow', options = {}) {
  return class extends HTMLElement {
    constructor() {
      super();

      if (domType === 'shadow') {
        const shadowRoot = this.attachShadow({
          mode: options.mode || 'open',
          ...options,
        });
        setupComponent(shadowRoot, styles, html, 'shadow');
      } else {
        setupComponent(this, styles, html, 'light');
      }
    }
  };
}

function applyStyles(target, styles, domType = 'shadow') {
  if (domType === 'shadow') {
    // Shadow DOM: use adoptedStyleSheets
    const styleSheet = new CSSStyleSheet();
    styleSheet.replaceSync(styles);
    target.adoptedStyleSheets = [styleSheet];
  } else {
    // Light DOM: create style element and append
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    target.appendChild(styleElement);
  }
}

function applyTemplate(target, html) {
  console.group('applyTemplate');
  console.log('target', target);
  console.log('html', html);
  console.groupEnd();
  const templateElement = document.createElement('template');
  templateElement.innerHTML = html;
  target.appendChild(templateElement.content.cloneNode(true));
}

export function setupComponent(target, styles, html, domType = 'shadow') {
  applyStyles(target, styles, domType);
  applyTemplate(target, html);
}

export function setupComponentAuto(target, styles, html) {
  console.group('setupComponentAuto');
  console.log('target', target);
  console.log('target instanceof ShadowRoot', target instanceof ShadowRoot ? 'shadow' : 'light');
  //   console.log('styles', styles);
  //   console.log('html', html);
  console.groupEnd();
  const domType = target instanceof ShadowRoot ? 'shadow' : 'light';
  setupComponent(target, styles, html, domType);
}
