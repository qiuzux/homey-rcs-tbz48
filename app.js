"use strict";

const Homey = require('homey');

class MyApp extends Homey.App {
  onInit() {
    this.log('RCS TBZ48 App is running...');
  }
}

module.exports = MyApp;