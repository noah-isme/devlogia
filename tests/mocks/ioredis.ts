export default class MockRedis {
  ping() {
    return Promise.resolve("PONG");
  }

  quit() {
    return Promise.resolve();
  }
}
