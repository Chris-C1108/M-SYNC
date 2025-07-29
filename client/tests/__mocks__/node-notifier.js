/**
 * Mock for node-notifier module
 */

module.exports = {
  notify: jest.fn((options, callback) => {
    if (callback) {
      setTimeout(() => callback(null, 'success'), 0);
    }
  })
};
