// jsdom does not implement matchMedia or ResizeObserver, which some Strato
// components touch on render. Provide inert stubs so widget tests can mount.
if (typeof window !== 'undefined') {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = function matchMedia(query) {
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: function () {},
        removeListener: function () {},
        addEventListener: function () {},
        removeEventListener: function () {},
        dispatchEvent: function () {
          return false;
        },
      };
    };
  }

  if (typeof window.ResizeObserver !== 'function') {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}
