// Brand loader — glowing gold "جاري صناعة الإلهام" in Gumela Arabic.
// Use `loaderHtml()` to get the markup (pairs with css/primitives/loader.css).
//
//   root.innerHTML = loaderHtml();             // default (4em)
//   root.innerHTML = loaderHtml({ size: 'md' });  // smaller
//   document.body.insertAdjacentHTML('beforeend', loaderOverlayHtml());  // full-surface boot overlay

const PHRASE = 'جاري صناعة الإلهام';

export function loaderHtml({ size } = {}) {
  const slices = Array.from({ length: 9 }, () => `<div class="text"><span>${PHRASE}</span></div>`).join('');
  const sizeAttr = size ? ` data-size="${size}"` : '';
  return `<div data-ui="loader"${sizeAttr}>${slices}<div class="line"></div></div>`;
}

export function loaderOverlayHtml({ size } = {}) {
  return `<div data-ui="loader-overlay">${loaderHtml({ size })}</div>`;
}
