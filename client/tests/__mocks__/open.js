/**
 * Mock for open module
 */

module.exports = jest.fn((url, options) => {
  return Promise.resolve();
});
