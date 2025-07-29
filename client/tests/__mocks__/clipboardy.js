/**
 * Mock for clipboardy module
 */

let clipboardContent = '';

module.exports = {
  read: jest.fn(() => Promise.resolve(clipboardContent)),
  write: jest.fn((text) => {
    clipboardContent = text;
    return Promise.resolve();
  }),
  readSync: jest.fn(() => clipboardContent),
  writeSync: jest.fn((text) => {
    clipboardContent = text;
  })
};
