const assert = require('assert');
const {
  Web3EventListener,
  MockStorage
} = require('../lib');

describe('Web3EventListener', function() {

  const mockWeb3 = {
    eth: {
      getBlock: function() {
        return Promise.resolve({number: 0})
      }
    }
  }
  const testEvent = {name: 'event_name',}
  const mockContract = {
    getPastEvents: function() {
      return Promise.resolve([testEvent])
    }
  }

  it('success to get events', () => {
    const eventListener = new Web3EventListener(
      mockWeb3,
      mockContract,
      MockStorage
    )
    eventListener.getEvents('event_name', (event) => {
      assert.deepEqual(event, testEvent)
      eventListener.cancel()
      done()
    })
  });

});
