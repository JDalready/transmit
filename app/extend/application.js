'use strict';

const DRI = Symbol('Application#DIR');

module.exports = {
  get dir() {
    if (!this[DRI]) {
      this[DRI] = {};
    }
    return this[DRI];
  },
  set dir(dir) {
    if (!this[DRI]) {
      this[DRI] = {};
    }
    for (const key in dir) {
      if (!this[DRI][key]) {
        this[DRI][key] = {};
      }
      this[DRI][key] = Object.assign(this[DRI][key], dir[key]);
    }
  },
};
