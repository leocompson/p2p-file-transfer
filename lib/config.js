var config = {};

config.welcome = {
  set lastupdate (val) {app.storage.write("lastupdate", val)},
  get lastupdate () {return app.storage.read("lastupdate") !== undefined ? app.storage.read("lastupdate") : 0}
};

config.interface = {
  set size (val) {app.storage.write("interfacesize", val)},
  set context (val) {app.storage.write("interfacecontext", val)},
  get size () {return app.storage.read("interfacesize") !== undefined ? app.storage.read("interfacesize") : config.interface.default.size},
  get context () {return app.storage.read("interfacecontext") !== undefined ? app.storage.read("interfacecontext") : config.interface.default.context},
  "default": {
    "context": "win",
    "size": {
      "width": 600, 
      "height": 700
    }
  }
};
