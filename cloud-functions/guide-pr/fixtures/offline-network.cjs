// Preloaded only by the local Functions Framework regression test.
// Prevent accidental external requests, regardless of inherited configuration.
globalThis.fetch = async url => {
  if (url === 'https://raw.githubusercontent.com/pvme/pvme-guides/master/mock/guide.txt') {
    return new Response(' Mock Unicode \u00e9\r\n{ "x" : 1 }\n---\r\n');
  }
  throw new Error('External network prohibited in local smoke test');
};
