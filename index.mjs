import { adjustRfc3339ByNano } from 'rfc3339nano';
import Account from './account.mjs';
import crypto from 'crypto';
import fs from 'fs';
import int64Buffer from 'int64-buffer';
import interval from 'interval-promise';
import request from './request.mjs';
import WebSocket from 'ws';
import wsreconnect from './ws-reconnect.mjs';
import zlib from 'zlib';

const { Uint64LE } = int64Buffer;

const MIXINNODE = function(opts) {
  let self = this;
  self.pullNetworkflag = false;
  opts = opts || {};
  self.pin = opts.pin;
  self.aeskey = opts.aeskey;
  self.client_id = opts.client_id;
  self.session_id = opts.session_id;
  self.pin_token = opts.pin_token;
  self.timeout = opts.timeout || 3600;
  self.api_domain = opts.api_domain || 'https://api.mixin.one';
  self.ws_domain = opts.ws_domain || 'wss://blaze.mixin.one/';
  opts.client_secret && (self.client_secret = opts.client_secret);
  opts.share_secret && (self.share_secret = opts.share_secret);
  if (opts.private_key) {
    self.privatekey = opts.private_key;
  } else if (typeof opts.privatekey === 'string') {
    const cert = fs.readFileSync(opts.privatekey);
    self.privatekey = cert;
  } else if (typeof opts.privatekey === 'object') {
    self.privatekey = opts.privatekey;
  }
  if (!self.pin || !self.client_id || !self.session_id || !self.privatekey || !(
    self.aeskey || self.pin_token
  )) { // aeskey: backward compatibility, pin_token: new Ed25519 session.
    throw ('pin, client_id, session_id, pin_token, private_key are required');
  }
  self.account = new Account(opts);

  self.encryptPIN = () => {
    return this.account.encryptCustomPIN(self.pin, self.aeskey);
  }

  // https://developers.mixin.one/api/h-conversations/create-conversation/
  // https://github.com/wangshijun/mixin-node-client/blob/f1c22b34c939b694db9cec72db3e941da10ac77e/lib/base.js
  self.newConversationId = (userId, recipientId) => {
    userId = userId.toString();
    recipientId = recipientId.toString();
    let [minId, maxId] = [userId, recipientId];
    if (minId > maxId) {
      [minId, maxId] = [recipientId, userId];
    }
    const hash = crypto.createHash('md5');
    hash.update(minId);
    hash.update(maxId);
    const bytes = hash.digest();
    bytes[6] = (bytes[6] & 0x0f) | 0x30;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    // eslint-disable-next-line unicorn/prefer-spread
    const digest = Array.from(bytes, byte => `0${(byte & 0xff).toString(16)}`.slice(-2)).join('');
    const uuid = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(
      16,
      20
    )}-${digest.slice(20, 32)}`;
    return uuid;
  };

  self.transferFromBot = (asset_id, recipient_id, amount, memo) => {
    return new Promise((resolve, reject) => {
      const seconds = Math.floor(Date.now() / 1000);
      const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;
      if (!memo)
        memo = "";
      if (typeof amount == 'number')
        amount = amount + '';
      let encrypted_pin = self.encryptPIN();
      let transfer_json =
      {
        asset_id: asset_id,
        counter_user_id: recipient_id,
        amount: amount,
        pin: encrypted_pin,
        trace_id: self.uuidv4()
      };

      if (memo != "")
        transfer_json["memo"] = memo;
      let transfer_json_str = JSON.stringify(transfer_json);
      let transfer_sig_str = "POST/transfers" + transfer_json_str;
      let transfer_sig_sha256 = crypto.createHash('sha256').update(transfer_sig_str).digest("hex");

      const payload = {
        uid: self.client_id, //bot account id
        sid: self.session_id,
        iat: seconds,
        exp: seconds_exp,
        jti: self.uuidv4(),
        sig: transfer_sig_sha256,
        scp: 'FULL',
      };

      let options = {
        url: `${self.api_domain}/transfers`,
        method: "POST",
        body: transfer_json_str,
        headers: {
          'Authorization': 'Bearer ' + self.account.getToken(payload, self.privatekey),
          'Content-Type': 'application/json'
        }
      }
      request(options, resolve, reject);
    });
  }

  self.readAssets = (asset_id) => {
    return new Promise((resolve, reject) => {
      const seconds = Math.floor(Date.now() / 1000);
      const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;
      // let encrypted_pin = self.encryptPIN();
      let transfer_sig_str = "GET/assets";

      let url = `${self.api_domain}/assets`;
      if (asset_id && asset_id.length == 36) {
        transfer_sig_str = "GET/assets/" + asset_id;
        url = `${self.api_domain}/assets/` + asset_id;
      }
      let transfer_sig_sha256 = crypto.createHash('sha256').update(transfer_sig_str).digest("hex");

      const payload = {
        uid: self.client_id, //bot account id
        sid: self.session_id,
        iat: seconds,
        exp: seconds_exp,
        jti: self.uuidv4(),
        sig: transfer_sig_sha256,
        scp: 'FULL',
      };

      let options = {
        url: url,
        method: "GET",
        headers: {
          'Authorization': 'Bearer ' + self.account.getToken(payload, self.privatekey),
          'Content-Type': 'application/json'
        }
      }
      request(options, resolve, reject);
    });
  }

  self.readProfile = (access_token) => {
    return new Promise((resolve, reject) => {
      let url = `${self.api_domain}/me`;
      let token = "";
      if (!access_token) {
        const seconds = Math.floor(Date.now() / 1000);
        const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;
        let encrypted_pin = self.encryptPIN();
        let transfer_sig_str = "GET/me";
        let transfer_sig_sha256 = crypto.createHash('sha256').update(transfer_sig_str).digest("hex");
        const payload = {
          uid: self.client_id, //bot account id
          sid: self.session_id,
          iat: seconds,
          exp: seconds_exp,
          jti: self.uuidv4(),
          sig: transfer_sig_sha256,
          scp: 'FULL',
        };
        token = self.account.getToken(payload, self.privatekey);
      } else {
        token = access_token;
      }
      let options = {
        url: url,
        method: "GET",
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      }
      request(options, resolve, reject);
    });
  }

  self.readNetworkSnapshots = (offset, asset, limit, order) => {
    return new Promise((resolve, reject) => {
      let _order = "DESC";
      if (order) { _order = order };
      let path = `/network/snapshots?limit=${limit}&offset=${offset}&order=${_order}`;
      if (asset && asset != "") { path = path + `&asset=${asset}`; }
      let url = self.api_domain + path;
      let token = self.tokenGET(path, "");
      let options = {
        url: url,
        method: "GET",
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': '0'
        }
      }
      request(options, resolve, reject);
    });
  };

  self.readNetworkTransfer = (trace_id) => {
    return new Promise((resolve, reject) => {
      let path = `/transfers/trace/${trace_id}`;
      let url = self.api_domain + path;
      let token = self.tokenGET(path, "");
      let options = {
        url: url,
        method: "GET",
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': '0'
        }
      }
      request(options, resolve, reject);
    });
  };

  self.readNetworkSnapshot = (snapshot_id, view_token) => {
    return new Promise((resolve, reject) => {
      let path = `/network/snapshots/${snapshot_id}`;
      let url = self.api_domain + path;
      let token = view_token || self.tokenGET(path, "");
      let options = {
        url: url,
        method: "GET",
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': '0'
        }
      }
      request(options, resolve, reject);
    });
  };

  self.requestAccessToken = (code) => {
    return new Promise((resolve, reject) => {
      let auth_json = {
        client_id: self.client_id,
        code: code,
        client_secret: self.client_secret
      };
      let auth_json_str = JSON.stringify(auth_json);
      let options = {
        url: `${self.api_domain}/oauth/token`,
        method: "POST",
        body: auth_json_str,
        headers: {
          'Content-Type': 'application/json'
        }
      }
      request(options, resolve, reject);
    });
  }

  self.readUser = (uuid) => {
    return new Promise((resolve, reject) => {
      let path = `/users/${uuid}`;
      let url = self.api_domain + path;
      let token = self.tokenGET(path, "");
      let options = {
        url: url,
        method: "GET",
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': '0'
        }
      }
      request(options, resolve, reject);
    });
  };

  self.searchUser = (idOrPhone) => {
    return new Promise((resolve, reject) => {
      let path = `/search/${idOrPhone}`;
      let url = self.api_domain + path;
      let token = self.tokenGET(path, "");
      let options = {
        url: url,
        method: "GET",
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': '0'
        }
      }
      request(options, resolve, reject);
    });
  };

  self.jwtToken = (method, uri, body, opts) => {
    let transfer_sig_str = method + uri + body;
    let transfer_sig_sha256 = crypto.createHash('sha256').update(transfer_sig_str).digest("hex");

    const seconds = Math.floor(Date.now() / 1000);
    let time = new Uint64LE(seconds);
    let seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;
    if (opts && opts.timeout)
      seconds_exp = Math.floor(Date.now() / 1000) + opts.timeout;

    const payload = {
      uid: self.client_id, //bot account id
      sid: self.session_id,
      iat: seconds,
      exp: seconds_exp,
      jti: self.uuidv4(),
      sig: transfer_sig_sha256,
      scp: 'FULL',
    };
    //console.log(payload);
    return self.account.getToken(payload, self.privatekey);
  }

  self.tokenGET = (uri, body, opts) => {
    return this.jwtToken("GET", uri, body, opts);
  }

  self.uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  self.ws_send = (message) => {
    return new Promise((resolve, reject) => {
      try {
        let buf = Buffer.from(JSON.stringify(message), 'utf-8');
        zlib.gzip(buf, function(_, zippedmsg) {
          if (self.ws.socket.readyState == WebSocket.OPEN) {
            self.ws.send(zippedmsg);
            resolve();
          } else {
            reject("websocket_not_ready");
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  self.send_ACKNOWLEDGE_MESSAGE_RECEIPT = (message_id) => {
    return new Promise((resolve, reject) => {
      try {
        let id = self.uuidv4();
        let message = {
          "id": id,
          "action": "ACKNOWLEDGE_MESSAGE_RECEIPT",
          "params": {
            "message_id": message_id,
            "status": "READ"
          }
        }
        self.ws_send(message).then(function() {
          resolve(id);
        }).catch(function(err) {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  self.send_LIST_PENDING_MESSAGES = () => {
    return new Promise((resolve, reject) => {
      try {
        let id = self.uuidv4();
        let message = {
          "id": id,
          "action": "LIST_PENDING_MESSAGES"
        }
        self.ws_send(message).then(function() {
          resolve(id);
        }).catch(function(err) {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  self.send_CREATE_MESSAGE = (opts, msgobj, options) => {
    return new Promise((resolve, reject) => {
      options = options || {};
      try {
        let message_id = self.uuidv4();
        let params = { "conversation_id": msgobj.data.conversation_id || self.newConversationId(self.client_id, msgobj.data.user_id), "recipient_id": msgobj.data.user_id, "message_id": message_id, "category": opts.category, "data": opts.data }
        let message = { id: self.uuidv4(), "action": "CREATE_MESSAGE", params: params }

        if (options.http) {
          const seconds = Math.floor(Date.now() / 1000);
          const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;
          let message_json_str = JSON.stringify([params]);
          let message_sig_str = "POST/messages" + message_json_str;
          let message_sig_sha256 = crypto.createHash('sha256').update(message_sig_str).digest("hex");
          const payload = {
            uid: self.client_id, //bot account id
            sid: self.session_id,
            iat: seconds,
            exp: seconds_exp,
            jti: self.uuidv4(),
            sig: message_sig_sha256,
            scp: 'FULL',
          };
          let options = {
            url: `${self.api_domain}/messages`,
            method: "POST",
            body: message_json_str,
            headers: {
              'Authorization': 'Bearer ' + self.account.getToken(payload, self.privatekey),
              'Content-Type': 'application/json'
            }
          }
          return request(options, resolve, reject);
        }

        self.ws_send(message).then(function() {
          resolve(message_id);
        }).catch(function(err) {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  self.generateMultisigPayment = (data, useroptions) => {
    return new Promise((resolve, reject) => {
      data = data || {};
      data.trace_id = data.trace_id || self.uuidv4();
      const payload_json_str = JSON.stringify(data);
      const payload = {
        uid: useroptions?.client_id || self.client_id,
        sid: useroptions?.session_id || self.session_id,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + self.timeout,
        jti: self.uuidv4(),
        sig: crypto.createHash('sha256').update('POST/payments' + payload_json_str).digest('hex'),
        scp: 'FULL',
      };
      const token = self.account.getToken(
        payload, useroptions?.private_key || useroptions?.privatekey || self.privatekey
      );
      const options = {
        url: `${self.api_domain}/payments`,
        method: 'POST',
        body: payload_json_str,
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      }
      request(options, resolve, reject);
    });
  };

  self.wsopts = () => {
    let token = self.tokenGET("/", "");
    let options = {
      headers: {
        "Authorization": "Bearer " + token,
        "perMessageDeflate": false
      }
    }
    return options;
  }

  self.startws = () => {
    self.ws = new wsreconnect(self.ws_domain || 'wss://blaze.mixin.one/', 'Mixin-Blaze-1', self, {});
    self.ws.on("error", (event) => {
      if (self.onError) {
        self.onError(event);
      }
    });
    self.ws.on("closed", (event) => {
      if (self.onClosed) {
        self.onClosed(event);
      }
    });
    self.ws.on("reconnect", () => {
      if (self.onReconnect) {
        self.onReconnect();
      }
    });
    self.ws.on("connect", () => {
      if (self.onConnect) {
        self.onConnect();
      }
    });
    self.ws.on("destroyed", (event) => {
      if (self.onDestroyed) {
        self.onDestroyed(event);
      }
    });
    self.ws.on("message", (data) => {
      if (self.onMessage) {
        self.onMessage(data);
      }
    });
    self.ws.start();
    return self.ws;
  }
}

MIXINNODE.prototype.Assets = function(asset_id) {
  return this.readAssets(asset_id);
}

MIXINNODE.prototype.readProfile = function(access_token) {
  return this.readProfile(access_token);
}

MIXINNODE.prototype.transferFromBot = function() {
  return this.transferFromBot(asset_id, recipient_id, amount, memo);
}
MIXINNODE.prototype.authTokenGET = function(uri, body) {
  return this.tokenGET(uri, body);
}
MIXINNODE.prototype.newuuid = function() {
  return this.uuidv4();
}

MIXINNODE.prototype.decode = function(data) {
  return new Promise((resolve, reject) => {
    try {
      zlib.gunzip(data, function(err, dezipped) {
        let msgobj = JSON.parse(dezipped.toString());
        resolve(msgobj);
      })
    } catch (err) {
      reject(err);
    }
  });
}

MIXINNODE.prototype.start = function() {
  return this.startws();
}

MIXINNODE.prototype.getwsopts = function() {
  return this.wsopts();
}

MIXINNODE.prototype.sendText = function(text, msgobj, options) {
  let opts = {};
  opts.category = "PLAIN_TEXT";
  opts.data = Buffer.from(text).toString('base64');
  return this.send_CREATE_MESSAGE(opts, msgobj, options);
}

MIXINNODE.prototype.sendImage = function(base64data, msgobj, options) {
  let opts = {};
  opts.category = "PLAIN_IMAGE";
  opts.data = base64data;
  return this.send_CREATE_MESSAGE(opts, msgobj, options);
}

MIXINNODE.prototype.sendButton = function(text, msgobj, options) {
  let opts = {};
  opts.category = "APP_BUTTON_GROUP";
  opts.data = Buffer.from(text).toString('base64');
  return this.send_CREATE_MESSAGE(opts, msgobj, options);
}

MIXINNODE.prototype.sendCard = function(text, msgobj, options) {
  let opts = {};
  opts.category = "APP_CARD";
  opts.data = Buffer.from(text).toString('base64');
  return this.send_CREATE_MESSAGE(opts, msgobj, options);
}

MIXINNODE.prototype.sendMsg = function(action, opts) {
  switch (action) {
    case "ACKNOWLEDGE_MESSAGE_RECEIPT":
      return this.send_ACKNOWLEDGE_MESSAGE_RECEIPT(opts.message_id);
    case "LIST_PENDING_MESSAGES":
      return this.send_LIST_PENDING_MESSAGES();
    default:
      return '';
  }
}

MIXINNODE.prototype.requestAccessToken = function(code) {
  return this.requestAccessToken(code);
}

MIXINNODE.prototype.readUser = function(uuid) {
  return this.readUser(uuid);
}

MIXINNODE.prototype.searchUser = function(idOrPhone) {
  return this.searchUser(idOrPhone);
}

MIXINNODE.prototype.readSnapshots = function(offset, asset, limit, order) {
  return this.readNetworkSnapshots(offset, asset, limit, order);
}

MIXINNODE.prototype.readTransfer = function(trace_id) {
  return this.readNetworkTransfer(trace_id);
}

MIXINNODE.prototype.readSnapshot = function(snapshot_id, view_token) {
  return this.readNetworkSnapshot(snapshot_id, view_token);
}

MIXINNODE.prototype.generateMultisigPayment = function(payload) {
  return this.generateMultisigPayment(payload);
}

MIXINNODE.prototype.getViewToken = function(uri, opts) {
  return this.tokenGET(uri, "", opts);
}

MIXINNODE.prototype.signJWT = function(payload) {
  return self.account.getToken(payload, this.share_secret);
}

MIXINNODE.prototype.startPullNetwork = function(timeinterval, opts, eventHandler) {
  this.pullNetworkflag = true;
  interval(async (iteration, stop) => {
    if (this.pullNetworkflag == false) {
      stop()
    } else {
      let session = {};
      try {
        session = JSON.parse(fs.readFileSync('session.json', 'utf8'));
      } catch (err) {
        if (opts.offset)
          session = { offset: offset };
        else {
          let current = new Date();
          session = { offset: current.toISOString() };
          let json = JSON.stringify(session);
          fs.writeFileSync('session.json', json, 'utf8');
        }
      }
      try {
        let results = await this.readNetworkSnapshots(
          adjustRfc3339ByNano(session.offset, 1),
          opts.asset_id, opts.limit, opts.order
        );
        results = results.data;
        for (let i in results) {
          session.offset = results[i].created_at;
          if (results[i].user_id) {
            eventHandler(results[i]);
          }
          let json = JSON.stringify(session);
          fs.writeFileSync('session.json', json, 'utf8');
        }
      } catch (err) {
        console.log(err);
      }
    }
  }, timeinterval);
}

MIXINNODE.prototype.stopPullNetwork = function() {
  this.pullNetworkflag = false;
}

export default MIXINNODE;
