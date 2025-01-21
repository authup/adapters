// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('node:crypto');

module.exports = () => {
    // eslint-disable-next-line no-undef
    Object.defineProperty(globalThis, 'crypto', crypto);
};
