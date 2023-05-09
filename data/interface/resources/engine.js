/* global P2P, Socket, Peer */

'use strict';

const COMMON = Symbol('common');
const INCLUDE = Symbol('include');
const GUID = ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

const configuration = {
  'timeout': {
    'peer': 10000,
    'resize': 1000
  },
  'server': {
    'iceServers': [{
      'urls': [
        'stun:stun.mit.de:3478',
        'stun:stun.l.google.com:19302',
        'stun:stun.services.mozilla.com:3478'
      ]
    }]
  }
};

class BasicEvent {
  constructor() {
    this.callbacks = [];
  }
  //
  addListener(c) {
    this.callbacks.push(c);
  }
  //
  emit(...args) {
    for (const c of this.callbacks) {
      c(...args);
    }
  }
}

class Socket {
  constructor(origin, key) {
    this.key = key;
    this.onMessage = new BasicEvent();
    this.onConnectionStateChanged = new BasicEvent();
    this.server = origin.replace('[API_KEY]', this.key);
  }
  //
  create(cid = 1) {
    if (cid < 1 || cid > 10000) {
      throw Error('range limit');
    }
    //
    this.cid = cid;
    //
    return new Promise((resolve, reject) => {
      try {
        const socket = this.socket = new WebSocket(this.server.replace('[CHANNEL_ID]', cid));
        //
        socket.onclose = () => {
          reject(Error('WebSocket connection is closed!'));
          this.onConnectionStateChanged.emit('socket', 'closed(0)');
        };
        //
        socket.onopen = () => {
          setTimeout(() => {
            if (socket.readyState === 1) {
              resolve();
              this.onConnectionStateChanged.emit('socket', 'ready');
            } else {
              reject(Error('WebSocket connection is closed!'));
              this.onConnectionStateChanged.emit('socket', 'closed(1)');
            }
          }, 500);
        };
        //
        socket.onmessage = e => {
          this.decrypt(e.data).then(msg => {
            msg = JSON.parse(msg);
            if ('recipient' in msg) {
              if (msg.recipient === GUID) {
                this.onMessage.emit(msg);
              }
            } else {
              this.onMessage.emit(msg);
            }
          }).catch(() => {
            try {
              const j = JSON.parse(e.data);
              if (j.error) {
                alert(j.error);
              } else {
                throw Error('Message is not encrypted!');
              }
            } catch (e) {
              console.warn('Cannot decrypt the encrypted message!');
            }
          });
        };
      } catch (e) {
        reject(Error('WebSocket connection is closed!'));
        this.onConnectionStateChanged.emit('socket', 'closed(2)');
      }
    });
  }
  //
  encrypt(msg) {
    return Promise.resolve(msg);
  }
  //
  decrypt(msg) {
    return Promise.resolve(msg);
  }
  //
  restart() {
    this.close();
    this.create(this.cid);
  }
  //
  close() {
    try {
      this.socket.close();
    } catch (e) {
      /*  */
    }
  }
  //
  send(msg, recipient) {
    const tmp = {
      ...msg,
      'sender': GUID
    };
    //
    if (recipient) {
      tmp.recipient = recipient;
    }
    //
    this.encrypt(JSON.stringify(tmp)).then(e => this.socket.send(e));
  }
}

class Peer {
  constructor(socket, configuration, recipient) {
    let cid;
    const candidates = [];
    const pc = this.pc = new RTCPeerConnection(configuration);
    //
    this.channels = {};
    this.socket = socket;
    this.recipient = recipient;
    this.onTrack = new BasicEvent();
    this.onMessage = new BasicEvent();
    this.onConnectionStateChanged = new BasicEvent();
    //
    pc.ontrack = e => this.onTrack.emit(e.streams[0]);
    pc.ondatachannel = e => {this.channel(e.channel.label, e.channel)};
    pc.onconnectionstatechange = () => this.onConnectionStateChanged.emit('peer', pc.connectionState);
    //
    pc.onicecandidate = ({candidate}) => {
      if (candidate) {
        this.onConnectionStateChanged.emit('candidate', 'generated');
        //
        if (cid) window.clearTimeout(cid);
        cid = setTimeout(() => {socket.send({candidates}, recipient)}, 500);
        //
        candidates.push(candidate);
      }
    };
    //
    socket.onMessage.addListener(msg => this.parse(msg));
  }
  //
  async offer() {
    const {socket, pc} = this;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.send({"desc": pc.localDescription}, this.recipient);
  }
  //
  async parse(msg) {
    if (msg.sender !== this.recipient) {
      return;
    }
    //
    const {desc, candidates} = msg;
    const {socket, pc} = this;
    if (candidates) {
      for (const candidate of candidates) {
        pc.addIceCandidate(candidate);
      }
    } else if (desc && desc.type === 'answer') {
      this.onConnectionStateChanged.emit('desc', 'received');
      pc.setRemoteDescription(desc);
    } else if (desc && desc.type === 'offer') {
      this.onConnectionStateChanged.emit('desc', 'received');
      await pc.setRemoteDescription(desc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.send({"desc": answer}, this.recipient);
    }
  }
  //
  close() {
    const {pc} = this;
    pc.close();
    this.onConnectionStateChanged.emit('channel', 'closed');
  }
  //
  send(data, name) {
    try {
      this.channels[name].send(data);
    } catch (e) {
      console.error(e);
    }
  }
  //
  channel(name, ch) {
    ch = ch ? ch : this.pc.createDataChannel(name);
    //
    ch.onmessage = e => this.onMessage.emit(e.data);
    ch.onopen = () => this.onConnectionStateChanged.emit('channel', 'ready');
    ch.onclose = () => this.onConnectionStateChanged.emit('channel', 'closed');
    //
    this.channels[ch.label] = ch;
  }
}

class P2P {
  constructor(origin, key) {
    const socket = this.socket = new class extends Socket {
      encrypt(msg) {
        return SAFE.encrypt(msg);
      }
      //
      decrypt(msg) {
        return SAFE.decrypt(msg);
      }
    }(origin, key);
    //
    socket.onConnectionStateChanged.addListener((type, state) => {
      this.onConnectionStateChanged.emit(type, state);
    });
    //
    socket.onMessage.addListener(msg => {
      if (msg.method === 'whoami') {
        this.client(msg.sender).then(peer => {
          peer.extra = msg.extra;
          this[INCLUDE](msg.sender, peer);
          //
          socket.send({
            'extra': this.exta,
            'method': 'whoami-reply'
          }, msg.sender);
        });
      } else if (msg.method === 'whoami-reply') {
        this.server(msg.sender).then(peer => {
          peer.extra = msg.extra;
          this[INCLUDE](msg.sender, peer);
          peer.offer();
        });
      }
    });
    //
    this.peers = {};
    this.onMessage = new BasicEvent();
    this.onCountChanged = new BasicEvent();
    this.onConnectionStateChanged = new BasicEvent();
  }
  //
  [COMMON](recipient) {
    const p = new Peer(this.socket, configuration.server, recipient);
    p.onMessage.addListener(request => {
      this.onMessage.emit(recipient, request);
      if (request.method === 'socket-restart') {
        this.socket.restart();
      }
    });
    //
    return p;
  }
  //
  [INCLUDE](guid, p) {
    this.peers[guid] = p;
    p.onConnectionStateChanged.addListener((type, state) => {
      const cond_1 = type === 'channel' && state === 'closed';
      const cond_2 = type === 'peer' && (state === 'disconnected' || state === 'failed');
      //
      if (cond_1 || cond_2) {
        delete this.peers[guid];
      }
      //
      this.onConnectionStateChanged.emit(type + ' - ' + guid, state);
    });
  }
  //
  async client(recipient) {
    return this[COMMON](recipient);
  }
  //
  async server(recipient) {
    const p = this[COMMON](recipient);
    p.channel('p2p');
    return p;
  }
  //
  get count() {
    return this._count || 1;
  }
  //
  set count(v) {
    this._count = v;
    this.onCountChanged.emit(v);
  }
  //
  password(v) {
    return SAFE.password(v);
  }
  //
  send(o, name) {
    for (const peer of Object.values(this.peers)) {
      peer.send(o, name);
    }
  }
  //
  join(cid, extra = {}) {
    this.exta = extra;
    return this.socket.create(cid).then(() => this.socket.send({
      'extra': extra,
      'method': 'whoami'
    }));
  }
}