var background = (function () {
  let tmp = {};
  let context = document.documentElement.getAttribute("context");
  if (!context || context === "webapp") {
    return {
      "send": function () {},
      "receive": function (callback) {}
    }
  } else {
    chrome.runtime.onMessage.addListener(function (request) {
      for (let id in tmp) {
        if (tmp[id] && (typeof tmp[id] === "function")) {
          if (request.path === "background-to-interface") {
            if (request.method === id) tmp[id](request.data);
          }
        }
      }
    });
    /*  */
    return {
      "receive": function (id, callback) {
        tmp[id] = callback;
      },
      "send": function (id, data) {
        chrome.runtime.sendMessage({
          "data": data,
          "method": id, 
          "path": "interface-to-background"
        }, function () {
          return chrome.runtime.lastError;
        });
      }
    }
  }
})();

var config = {
  "addon": {
    "homepage": function () {
      return chrome.runtime.getManifest().homepage_url;
    }
  },
  "resize": {
    "timeout": null,
    "method": function () {
      if (config.port.name === "win") {
        if (config.resize.timeout) window.clearTimeout(config.resize.timeout);
        config.resize.timeout = window.setTimeout(async function () {
          let current = await chrome.windows.getCurrent();
          /*  */
          config.storage.write("interfacesize", {
            "top": current.top,
            "left": current.left,
            "width": current.width,
            "height": current.height
          });
        }, 1000);
      }
    }
  },
  "storage": {
    "local": {},
    "read": function (id) {
      return config.storage.local[id];
    },
    "load": function (callback) {
      chrome.storage.local.get(null, function (e) {
        config.storage.local = e;
        if (callback) callback();
      });
    },
    "write": function (id, data, callback) {
      if (id) {
        if (data !== '' && data !== null && data !== undefined) {
          let tmp = {};
          tmp[id] = data;
          config.storage.local[id] = data;
          chrome.storage.local.set(tmp, function (e) {
            if (callback) callback(e);
          });
        } else {
          delete config.storage.local[id];
          chrome.storage.local.remove(id);
        }
      }
    }
  },
  "port": {
    "name": '',
    "connect": function () {
      config.port.name = "webapp";
      const favicons = [...document.querySelectorAll("link[sizes]")];
      const context = document.documentElement.getAttribute("context");
      /*  */
      if (chrome.action) {
        if (chrome.runtime) {
          if (chrome.runtime.connect) {
            if (context !== config.port.name) {
              if (document.location.search === "?tab") config.port.name = "tab";
              if (document.location.search === "?win") config.port.name = "win";
              if (document.location.search === "?popup") config.port.name = "popup";
              /*  */
              if (config.port.name === "popup") {
                document.body.style.width = "600px";
                document.body.style.height = "550px";
              }
              /*  */
              favicons.map(e => e.remove());
              chrome.runtime.connect({
                "name": config.port.name
              });
            }
          }
        }
      } else {
        try {
          if (window === window.top) {
            favicons.map(function (e) {
              const size = e.getAttribute("sizes").split('x')[0];
              e.setAttribute("type", "image/vnd.microsoft.icon");
              e.setAttribute("href", "resources/favicon/" + size + ".png");
            });
          } else {
            favicons.map(e => e.remove());
          }
        } catch (e) {}
      }
      /*  */
      document.documentElement.setAttribute("context", config.port.name);
    }
  },
  "listener": {
    "queue": null,
    "icon": function () {
      const reload = document.querySelector(".reload");
      const download = document.querySelector(".download");
      const state = document.documentElement.getAttribute("state");
      const queued = document.documentElement.getAttribute("queued");
      /*  */
      if (queued !== null) download.click();
      /*  */
      if (state === "progress") {
        const flag = window.confirm("Are you sure you want to cancel the file transfer?");
        if (flag) {
          //config.app.p2p.engine.send("cancel", "p2p");
          window.setTimeout(function () {
            reload.click();
          }, 300);
        }
      }
    },
    "details": function () {
      config.app.p2p.details.sender.querySelector("summary").addEventListener("click", function () {
        if (config.app.p2p.details.sender.open === false) {
          config.app.p2p.details.fileio.open = false;
          config.app.p2p.details.receiver.open = false;
        }
      });
      /*  */
      config.app.p2p.details.fileio.querySelector("summary").addEventListener("click", function () {
        if (config.app.p2p.details.fileio.open === false) {
          config.app.p2p.details.sender.open = false;
          config.app.p2p.details.receiver.open = false;
        }
      });
      /*  */
      config.app.p2p.details.receiver.querySelector("summary").addEventListener("click", function () {
        if (config.app.p2p.details.receiver.open === false) {
          config.app.p2p.details.sender.open = false;
          config.app.p2p.details.fileio.open = false;
        }
      });
    },
    "change": function (filelist) {
      if (config.app.p2p.engine) {
        const files = [...filelist];
        if (files) {
          if (files.length) {
            try {
              let current = 0;
              /*  */
              const file = files[0];
              const filesize = file.size;
              const filename = file.name;
              const filetype = file.type;
              const chunksize = 256 * 1024;
              const starttime = (new Date()).getTime();
              const totalchunks = Math.ceil(filesize / chunksize);
              const text = document.querySelector(".content .fileio-section .text");
              /*  */
              config.app.p2p.engine.send(JSON.stringify({
                "name": filename,
                "size": filesize,
                "type": filetype,
                "starttime": starttime,
                "chunksize": chunksize,
                "totalchunks": totalchunks
              }), "p2p");
              /*  */
              config.app.p2p.reader = new FileReader();
              config.app.p2p.reader.onload = function (e) {
                const chunk = e.target.result;
                config.app.p2p.engine.send(chunk, "p2p");
                current++;
                /*  */
                const inputfile = document.getElementById("inputfile");
                const progress = (current / totalchunks) * 100;
                const percent = Math.floor(progress) + '%';
                /*  */
                text.textContent = filename + " (" + percent + ')';
                document.documentElement.setAttribute("rule", "sender");
                document.documentElement.setAttribute("state", "progress");
                document.documentElement.style.setProperty("--percent", percent);
                document.documentElement.style.setProperty("--pcolor", "#777777");
                /*  */
                if (current < totalchunks) {
                  const start = current * chunksize;
                  const end = Math.min(start + chunksize, filesize);
                  config.app.p2p.chunk = file.slice(start, end);
                } else {
                  window.setTimeout(function () {
                    current = 0;
                    inputfile.value = '';
                    config.app.action.cleanup();
                  }, 300);
                }
              };
              /*  */
              config.app.p2p.chunk = file.slice(0, chunksize);
              config.app.p2p.reader.readAsArrayBuffer(config.app.p2p.chunk);
            } catch (e) {
              config.app.action.setup("error", "An unexpected error happened!", "Please reload the app and try again.");
            }
          }
        }
      }
    }
  },
  "load": function () {
    const now = document.getElementById("now");
    const itoken = document.getElementById("token");
    const reset = document.querySelector(".reset");
    const reload = document.querySelector(".reload");
    const iserver = document.getElementById("server");
    const support = document.getElementById("support");
    const datetime = document.getElementById("datetime");
    const donation = document.getElementById("donation");
    const download = document.querySelector(".download");
    const automatic = document.getElementById("automatic");
    const inputfile = document.getElementById("inputfile");
    const dialog = document.querySelector(".container .dialog");
    const sender = document.querySelector(".container .dialog .button.sender");
    const link = document.querySelector(".container .sender-section .wrapper a");
    const receiver = document.querySelector(".container .dialog .button.receiver");
    const copy = document.querySelector(".container .sender-section .wrapper .copy");
    const icon = document.querySelector(".container .fileio-section .wrapper .icon");
    const join = document.querySelector(".container .receiver-section input[type='button']");
    const number = document.querySelector(".container .receiver-section input[type='number']");
    /*  */
    config.app.p2p.details.sender = document.querySelector(".container .sender-section");
    config.app.p2p.details.fileio = document.querySelector(".container .fileio-section");
    config.app.p2p.details.receiver = document.querySelector(".container .receiver-section");
    /*  */
    icon.addEventListener("click", config.listener.icon);
    /*  */
    inputfile.addEventListener("change", function (e) {
      config.listener.change(e.target.files);
    });
    /*  */
    download.addEventListener("click", function () {
      if (config.app.p2p.queued) config.listener.queue();
    }, false);
    /*  */
    support.addEventListener("click", function () {
      const url = config.addon.homepage();
      chrome.tabs.create({"url": url, "active": true});
    }, false);
    /*  */
    donation.addEventListener("click", function () {
      const url = config.addon.homepage() + "?reason=support";
      chrome.tabs.create({"url": url, "active": true});
    }, false);
    /*  */
    iserver.addEventListener("change", function (e) {
      const value = e.target.value;
      if (value) config.app.p2p.options.servername = value;
    }, false);
    /*  */
    itoken.addEventListener("change", function (e) {
      const value = e.target.value;
      if (value) config.app.p2p.options.servertoken = value;
    }, false);
    /*  */
    automatic.addEventListener("change", function (e) {
      config.app.p2p.options.automaticdownload = e.target.checked;
      config.app.p2p.options.automaticdownload ? download.setAttribute("disabled", '') : download.removeAttribute("disabled");
    }, false);
    /*  */
    datetime.addEventListener("change", function (e) {
      config.app.p2p.options.datetime = e.target.checked;
      config.app.p2p.options.datetime ? now.setAttribute("render", '') : now.removeAttribute("render");
    }, false);
    /*  */
    sender.addEventListener("click", function () {
      dialog.remove();
      config.app.p2p.context = "sender";
      config.app.start();
    }, false);
    /*  */
    receiver.addEventListener("click", function () {
      dialog.remove();
      config.app.p2p.context = "receiver";
      config.app.start();
    }, false);
    /*  */
    copy.addEventListener("click", function (e) {
      const href = link.getAttribute("href");
      if (navigator.clipboard) {
        navigator.clipboard.writeText(href);
        /*  */
        e.target.setAttribute("color", '');
        window.setTimeout(function () {
          e.target.removeAttribute("color");
        }, 300);
      }
    }, false);
    /*  */
    join.addEventListener("click", function () {
      if (number.value) {
        if (number.value.length === 6) {
          config.app.p2p.context = "fileio";
          config.app.p2p.metrics.token = number.value;
          config.app.action.join(true);
        } else {
          window.alert("Please enter a 6-digit token number.");
        }
      } else {
        window.alert("Please enter a 6-digit token number.");
      }
    }, false);
    /*  */
    number.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        /*  */
        if (e.target.value) {
          if (e.target.value.length === 6) {
            config.app.p2p.context = "fileio";
            config.app.p2p.metrics.token = e.target.value;
            config.app.action.join(true);
          } else {
            window.alert("Please enter a 6-digit token number.");
          }
        } else {
          window.alert("Please enter a 6-digit token number.");
        }
      }
    });
    /*  */
    reset.addEventListener("click", function () {
      const flag = window.confirm("Are you sure you want to reset the app? Reverts all options and metrics to the original factory set defaults.");
      /*  */
      if (flag) {
        config.storage.write("context", '');
        config.storage.write("currenttoken", '');
        config.storage.write("interfacesize", '');
        /*  */
        config.app.p2p.options.datetime = '';
        config.app.p2p.options.servername = '';
        config.app.p2p.options.servertoken = '';
        config.app.p2p.options.automaticdownload = '';
        /*  */
        window.setTimeout(function () {
          config.app.p2p.metrics.url = new URL(document.location);
          config.app.p2p.metrics.url.searchParams.delete("token");
          document.location.replace(config.app.p2p.metrics.url.href);
        }, 300);
      }
    }, false);
    /*  */
    reload.addEventListener("click", function (e) {
      if (e) {
        if (e.isTrusted) {
          const state = document.documentElement.getAttribute("state");
          if (state === "progress") {
            const flag = window.confirm("Are you sure you want to reload the current session? Note: it will cancel the ongoing file transfer.");
            if (flag) {
              document.location.reload();
            }
          } else {
            document.location.reload();
          }
        } else {
          document.location.reload();
        }
      }
    }, false);
    /*  */
    config.app.p2p.metrics.url = new URL(document.location);
    config.app.p2p.metrics.param = config.app.p2p.metrics.url.searchParams.get("token");
    config.storage.load(function () {
      const SHOWKEY = config.storage.read("servertoken") !== undefined;
      /*  */
      iserver.value = config.app.p2p.options.servername;
      datetime.checked = config.app.p2p.options.datetime;
      automatic.checked = config.app.p2p.options.automaticdownload;
      if (SHOWKEY) itoken.value = config.app.p2p.options.servertoken;
      config.app.p2p.metrics.token = config.storage.read("currenttoken");
      config.app.p2p.options.datetime ? now.setAttribute("render", '') : now.removeAttribute("render");
      config.app.p2p.options.automaticdownload ? download.setAttribute("disabled", '') : download.removeAttribute("disabled");
      /*  */
      if (config.app.p2p.metrics.token !== undefined) {
        dialog.remove();
        config.app.update.status("Starting the app with the previous token: " + config.app.p2p.metrics.token);
        /*  */
        window.setTimeout(function () {
          config.app.start();
        }, 300);
      } else {
        if (config.app.p2p.metrics.param) {
          dialog.remove();
          config.app.p2p.context = "receiver";
          window.setTimeout(function () {
            config.app.start();
          }, 300);
        } else {
          config.app.update.status("To start, please press either the sender or receiver button");
        }
      }
    });
    /*  */
    config.listener.details();
    window.setInterval(config.app.update.time, 1000);
    window.removeEventListener("load", config.load, false);
    window.addEventListener("dragover", e => e.preventDefault(), false);
    window.addEventListener("drop", function (e) {
      e.preventDefault();
      config.listener.change(e.dataTransfer.files);
    }, false);
  },
  "app": {
    "p2p": {
      "guids": [],
      "info": null,
      "chunk": null,
      "details": {},
      "engine": null,
      "context": null,
      "queued": false,
      "metrics": {
        "url": '',
        "param": '',
        "token": ''
      },
      "options": {
        "ORIGIN": "wss://p2p-2zan.onrender.com/[CHANNEL_ID]?apiKey=[API_KEY]",
        "KEY": "REVyV2Y0M0hKZk5CMjFSa05JY05IWjBkRFIzVEhZN0c5SGY1MzRGZEV3TldtaDNRVUd4d1RSS2k4NDZ5SFRnZQ==",
        //
        set datetime (val) {config.storage.write("datetime", val)},
        set servername (val) {config.storage.write("servername", val)},
        set servertoken (val) {config.storage.write("servertoken", val)},
        set automaticdownload (val) {config.storage.write("automaticdownload", val)},
        get datetime () {return config.storage.read("datetime") !== undefined ? config.storage.read("datetime") : true},
        get automaticdownload () {return config.storage.read("automaticdownload") !== undefined ? config.storage.read("automaticdownload") : true},
        get servername () {return config.storage.read("servername") !== undefined ? config.storage.read("servername") : config.app.p2p.options.ORIGIN},
        get servertoken () {return config.storage.read("servertoken") !== undefined ? config.storage.read("servertoken") : atob(config.app.p2p.options.KEY)}
      }
    },
    "capitalize": function (e) {
      return e.charAt(0).toUpperCase() + e.slice(1);
    },
    "update": {
      "status": function (e) {
        const status = document.getElementById("status");
        /*  */
        status.textContent = e;
      },
      "time": function () {
        const now = document.getElementById("now");
        /*  */
        now.textContent = new Intl.DateTimeFormat("en-US", {
          "timeStyle": "medium",
          "dateStyle": "medium"
        }).format();
      }
    },
    "action": {
      "join": async function (flag) {
        const current = document.querySelector(".container .fileio-section .wrapper .current");
        /*  */
        try {
          if (flag) {
            config.app.p2p.details.fileio.open = true;
            config.app.p2p.details.sender.open = false;
            config.app.p2p.details.receiver.open = false;
            current.textContent = config.app.p2p.metrics.token;
          }
          /*  */
          const cid = Number(config.app.p2p.metrics.token.substring(3));
          await config.app.p2p.engine.password(config.app.p2p.metrics.token);
          await config.app.p2p.engine.join(cid, {"token": config.app.p2p.metrics.token});
        } catch (e) {
          const error = e && e.message ? e.message : "An unexpected error happened!";
          config.app.action.setup("error", error, "Please reload the app and try again.");
          /*  */
          config.app.p2p.details.fileio.open = true;
          config.app.p2p.details.sender.open = false;
          config.app.p2p.details.receiver.open = false;
        }
      },
      "setup": function (name, status, message) {
        const text = document.querySelector(".content .fileio-section .text");
        const time = document.querySelector(".content .fileio-section .time");
        /*  */
        document.documentElement.removeAttribute("state");
        document.documentElement.removeAttribute("ready");
        document.documentElement.removeAttribute("error");
        document.documentElement.removeAttribute("sender");
        document.documentElement.removeAttribute("queued");
        document.documentElement.removeAttribute("nopeers");
        document.documentElement.removeAttribute("loading");
        document.documentElement.removeAttribute("receiver");
        /*  */
        time.textContent = '';
        text.textContent = message;
        if (status) config.app.update.status(status);
        document.documentElement.setAttribute(name, '');
        document.documentElement.style.setProperty("--percent", '0%');
        document.documentElement.setAttribute(config.app.p2p.context, '');
      },
      "cleanup": function () {
        const text = document.querySelector(".content .fileio-section .text");
        const time = document.querySelector(".content .fileio-section .time");
        /*  */
        document.documentElement.removeAttribute("rule");
        document.documentElement.removeAttribute("state");
        document.documentElement.removeAttribute("ready");
        document.documentElement.removeAttribute("error");
        document.documentElement.removeAttribute("queued");
        document.documentElement.removeAttribute("nopeers");
        document.documentElement.removeAttribute("loading");
        /*  */
        time.textContent = '';
        config.app.p2p.guids = [];
        config.app.p2p.info = null;
        config.app.p2p.chunk = null;
        config.app.update.status("Ready");
        document.documentElement.setAttribute("ready", '');
        document.documentElement.style.setProperty("--percent", '0%');
        text.textContent = "Click to browse or drag a file here to start sharing.";
      },
      "qrcode": {
        "generate": function (e) {
          const link = document.querySelector(".container .sender-section .wrapper a");
          const icon = document.querySelector(".container .sender-section .wrapper .icon");
          const current = document.querySelector(".container .fileio-section .wrapper .current");
          const token = document.querySelector(".container .sender-section .wrapper[render] .token");
          /*  */
          config.app.p2p.metrics.url = new URL(document.location);
          config.app.p2p.metrics.url.searchParams.append("token", e);
          const content = config.app.p2p.metrics.url.href;
          /*  */
          if (content) {
            const parser = new DOMParser();
            const output = new QRCode({
              "join": true,
              "padding": 1,
              "color": "#333",
              "content": content,
              "background": "#FFFFFF",
              "container": "svg-viewbox"
            });
            /*  */
            const parsed = parser.parseFromString(output.svg(), "application/xml");
            const svg = parsed.querySelector("svg");
            /*  */
            link.href = content;
            icon.textContent = '';
            icon.appendChild(svg);
            token.textContent = e;
            current.textContent = e;
            link.textContent = content;
          }
        }
      }
    },
    "start": function () {
      let chunks = [];
      let chunksreceived = 0;
      /*  */
      const appcontext = document.documentElement.getAttribute("context");
      const text = document.querySelector(".content .fileio-section .text");
      const time = document.querySelector(".content .fileio-section .time");
      const long = document.querySelector(".container .sender-section .wrapper.long");
      const short = document.querySelector(".container .sender-section .wrapper.short");
      const qrcode = document.querySelector(".container .sender-section .wrapper .icon");
      const current = document.querySelector(".container .fileio-section .wrapper .current");
      const number = document.querySelector(".container .receiver-section input[type='number']");
      /*  */
      time.textContent = '';
      qrcode.textContent = '';
      long.removeAttribute("render");
      long.removeAttribute("render");
      config.app.p2p.queued = !config.app.p2p.options.automaticdownload;
      config.app.action.setup("loading", '', "Loading, please wait...");
      config.app.p2p.details.fileio.open = config.app.p2p.context === "fileio";
      config.app.p2p.details.sender.open = config.app.p2p.context === "sender";
      config.app.p2p.details.receiver.open = config.app.p2p.context === "receiver";
      appcontext === "webapp" ? long.setAttribute("render", '') : short.setAttribute("render", '');
      /*  */
      if (config.app.p2p.context === "receiver") config.app.update.status("Waiting to join a peer...");
      if (config.app.p2p.context === "sender") config.app.update.status("Waiting for the peer(s) to join...");
      if (config.app.p2p.context === "fileio") config.app.update.status("WebSocket is loading, please wait...");
      /*  */
      config.app.p2p.engine = new P2P(config.app.p2p.options.servername, config.app.p2p.options.servertoken);
      /*  */
      if (config.storage.read("currenttoken") === undefined) {
        config.app.p2p.metrics.token = (Math.floor(1e5 + Math.random() * 9e5)).toString();
        config.app.action.qrcode.generate(config.app.p2p.metrics.token);
        /*  */
        if (config.app.p2p.context !== "sender") {
          if (config.app.p2p.metrics.param) {
            config.app.p2p.metrics.token = config.app.p2p.metrics.param;
            current.textContent = config.app.p2p.metrics.token;
            number.value = config.app.p2p.metrics.token;
            /*  */
            if (config.app.p2p.context === "receiver") {
              config.app.action.join(true);
            }
          }
        }
      } else {
        config.app.p2p.metrics.token = config.storage.read("currenttoken");
        config.app.action.qrcode.generate(config.app.p2p.metrics.token);
        config.app.p2p.details.fileio.open = true;
      }
      /*  */
      if (config.app.p2p.context !== "receiver") {
        config.app.action.join(false);
      }
      /*  */
      config.app.p2p.engine.onConnectionStateChanged.addListener(function (ctype, state) {
        const type = ctype.split(" - ")[0];
        const guid = ctype.split(" - ")[1];
        const nopeers = state === "closed" || state === "failed" || state === "disconnected";
        /*  */
        if (nopeers) {
          if (config.app.p2p.guids.length === 0) {
            current.textContent = config.app.p2p.metrics.token;
            config.app.update.status("Waiting for the peer(s) to join...");
            config.app.action.setup("nopeers", '', "No peer(s) connected yet! Please add a peer to start sharing.");
          } else {
            if (guid && config.app.p2p.guids.indexOf(guid) !== -1) {
              current.textContent = config.app.p2p.metrics.token;
              config.app.update.status(config.app.capitalize(type) + " - " + config.app.capitalize(state));
              config.app.action.setup("nopeers", '', "Peer(s) disconnected! Please add a peer to start sharing.");
            }
          }
        } else {
          config.app.update.status("Waiting for the peer(s) to join...");
          config.app.action.setup("loading", '', "Loading, please wait...");
        }
        /*  */
        if (type === "socket") {
          if (state === "closed(0)") {
            config.storage.write("currenttoken", '');
          }
        }
        /*  */
        if (type === "channel") {
          if (state === "ready") {
            config.app.p2p.guids = Object.keys(config.app.p2p.engine.peers);
            /*  */
            window.setTimeout(function () {
              config.app.p2p.context = "fileio";
              config.storage.write("currenttoken", '');
              config.app.p2p.details.fileio.open = true;
              config.app.p2p.details.sender.open = false;
              config.app.p2p.details.receiver.open = false;
              config.app.action.setup("ready", "Ready", "Click to browse or drag a file here to start sharing.");
            }, 300);
          } else {
            chunks = [];
            chunksreceived = 0;
          }
        }
      });
      /*  */
      config.app.p2p.engine.onMessage.addListener(async function (guid, data) {
        const issender = config.app.p2p.chunk !== null;
        /*  */
        if (typeof data === "string") {
          if (data === "cancel") {
            document.querySelector(".reload").click();
          }
          //
          else if (data.startsWith(" @ ")) {
            if (issender) {
              config.app.update.status("Sending" + data);
            }
          }
          //
          else if (data.startsWith(": ")) {
            if (issender) {
              time.textContent = "Time left" + data;
            }
          }
          //
          else if (data === "nextchunk") {
            if (issender) {
              const index = config.app.p2p.guids.indexOf(guid);
              if (index !== -1) config.app.p2p.guids.splice(index, 1);
              /*  */
              if (config.app.p2p.guids.length === 0) {
                config.app.p2p.reader.readAsArrayBuffer(config.app.p2p.chunk);
                config.app.p2p.guids = Object.keys(config.app.p2p.engine.peers);
              }
            }
          }
          //
          else {
            if (data) {
              config.app.p2p.info = JSON.parse(data);
            }
          }
        } else {
          if (config.app.p2p.info) {
            if (config.app.p2p.queued) {
              await new Promise((resolve) => {
                config.listener.queue = resolve;
                config.app.action.setup("queued", "Press the download button to start...", config.app.p2p.info.name + " (download queued)");
              });
              /*  */
              config.app.p2p.queued = false;
              document.documentElement.removeAttribute("queued");
              document.documentElement.setAttribute("ready", '');
            }
            /*  */
            chunks.push(data);
            chunksreceived++;
            /*  */
            const endtime = (new Date()).getTime();
            const duration = ((endtime - config.app.p2p.info.starttime) / 1000) / chunksreceived;
            const bitspersec = ((config.app.p2p.info.chunksize * 8) / duration);
            const progress = (chunksreceived / config.app.p2p.info.totalchunks) * 100;
            const secondsleft = duration * (config.app.p2p.info.totalchunks - chunksreceived);
            const timeleft = new Date(secondsleft * 1000).toISOString().substring(11, 19);
            const index = bitspersec === 0 ? 0 : Math.floor(Math.log(bitspersec) / Math.log(1024));
            const speed = Math.floor(bitspersec / Math.pow(1024, index)) + ' ' + ['B', 'Kb', 'Mb', 'Gb', 'Tb'][index] + "ps";
            const percent = Math.floor(progress) + '%';
            /*  */
            text.textContent = config.app.p2p.info.name + ' (' + percent + ')';
            document.documentElement.style.setProperty("--pcolor", "#777777");
            document.documentElement.style.setProperty("--percent", percent);
            document.documentElement.setAttribute("state", "progress");
            document.documentElement.setAttribute("rule", "receiver");
            config.app.update.status("Receiving" + " @ " + speed);
            config.app.p2p.engine.send(": " + timeleft, "p2p");
            config.app.p2p.engine.send(" @ " + speed, "p2p");
            time.textContent = "Time left" + ": " + timeleft;
            /*  */
            if (chunksreceived === Math.ceil(config.app.p2p.info.size / config.app.p2p.info.chunksize)) {
              config.app.update.status("Preparing to download the file, please wait...");
              /*  */
              window.setTimeout(function () {
                const blob = new Blob(chunks, {"type": config.app.p2p.info.type});
                const href = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                /*  */
                link.download = config.app.p2p.info.name;
                link.href = href;
                link.click();
                /*  */
                window.setTimeout(function () {
                  window.URL.revokeObjectURL(href);
                  config.app.action.cleanup();
                  chunksreceived = 0;
                  chunks = [];
                }, 300);
              }, 300);
            } else {
              config.app.p2p.engine.send("nextchunk", "p2p");
            }
          }
        }
      });
    }
  }
};

config.port.connect();
window.addEventListener("load", config.load, false);
window.addEventListener("resize", config.resize.method, false);
