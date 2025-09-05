export function applyGlobalStyles(styles) {
  applyStyles(document, styles);
}

export function applyStyles(target, styles) {
  const styleSheet = new CSSStyleSheet();
  styleSheet.replaceSync(styles);
  target.adoptedStyleSheets = [styleSheet];
}

function applyTemplate(target, html) {
  const templateElement = document.createElement('template');
  templateElement.innerHTML = html;
  target.appendChild(templateElement.content.cloneNode(true));
}

export function setupComponent(target, styles, html) {
  applyStyles(target, styles);
  applyTemplate(target, html);
}
