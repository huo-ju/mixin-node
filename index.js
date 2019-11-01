const request = require('request');
const Uint64LE= require("int64-buffer").Uint64LE;
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const zlib = require("zlib");
const forge = require('node-forge');
const wsreconnect = require('./ws-reconnect');
const WebSocket = require('ws');
const interval = require('interval-promise');
const Account = require('./account');

const requestHandler = require('./requestHandler');
const rfc3339nano = require('rfc3339nano');

let MIXINNODE = function(opts) {
  let self = this;
  self.pullNetworkflag = false;
  opts = opts || {};
  self.pin= opts.pin;
  self.aeskey = opts.aeskey;
  self.client_id = opts.client_id;
  self.session_id = opts.session_id;
  self.timeout = opts.timeout || 3600;
  if(opts.client_secret)
    self.client_secret = opts.client_secret;
  if(opts.share_secret)
    self.share_secret = opts.share_secret;

  if(typeof opts.privatekey == "string"){
    const cert = fs.readFileSync(opts.privatekey);
    self.privatekey = cert;
  } else if(typeof opts.privatekey == "object"){
    self.privatekey = opts.privatekey;
  }
  if(!self.pin || !self.aeskey || !self.client_id || !self.session_id || !self.privatekey){
    throw ("pin, aeskey, client_id, session_id, privatekey are require fields");
  }
  self.account = new Account(opts);

  self.encryptPIN = () =>{
    return this.account.encryptCustomPIN(self.pin, self.aeskey);
  }


  self.transferFromBot = (asset_id, recipient_id, amount, memo) => {
    return new Promise((resolve, reject) => {
      const seconds = Math.floor(Date.now() / 1000);
      const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;
      if(!memo)
        memo="";
      if(typeof amount =='number')
        amount = amount+'';
      let encrypted_pin = self.encryptPIN();
      let transfer_json =
      {
        asset_id:        asset_id,
        counter_user_id: recipient_id,
        amount:          amount,
        pin:             encrypted_pin,
        trace_id:        self.uuidv4()
      };

      if(memo!="")
        transfer_json["memo"] = memo;
      let transfer_json_str = JSON.stringify(transfer_json);
      let transfer_sig_str = "POST/transfers"+transfer_json_str;
      let transfer_sig_sha256 = crypto.createHash('sha256').update(transfer_sig_str).digest("hex");

      let payload = {
        uid: self.client_id, //bot account id
        sid: self.session_id,
        iat: seconds ,
        exp: seconds_exp ,
        jti: self.uuidv4(),
        sig: transfer_sig_sha256
      };
      let token = jwt.sign(payload, self.privatekey,{ algorithm: 'RS512'});

      let options ={
        url:'https://api.mixin.one/transfers',
        method:"POST",
        body: transfer_json_str,
        headers: {
          'Authorization': 'Bearer '+token,
          'Content-Type' : 'application/json'
        }
      }
      request(options, function(err,httpResponse,body){
        requestHandler(err, body, resolve, reject);
      })

    });
  }

  self.readAssets = (asset_id) =>{
    return new Promise((resolve, reject) => {
      const seconds = Math.floor(Date.now() / 1000);
      const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;
      // let encrypted_pin = self.encryptPIN();
      let transfer_sig_str = "GET/assets";

      let url = 'https://api.mixin.one/assets';
      if ( asset_id && asset_id.length==36 ) {
        transfer_sig_str = "GET/assets/"+asset_id;
        url = 'https://api.mixin.one/assets/'+asset_id;
      }
      let transfer_sig_sha256 = crypto.createHash('sha256').update(transfer_sig_str).digest("hex");

      let payload = {
        uid: self.client_id, //bot account id
        sid: self.session_id,
        iat: seconds ,
        exp: seconds_exp ,
        jti: self.uuidv4(),
        sig: transfer_sig_sha256
      };
      let token = jwt.sign(payload, self.privatekey,{ algorithm: 'RS512'});

      let options ={
        url: url,
        method:"GET",
        headers: {
          'Authorization': 'Bearer '+token,
          'Content-Type' : 'application/json'
        }
      }
      request(options, function(err,httpResponse,body){
        requestHandler(err, body, resolve, reject);
      })

    });
  }

  self.readProfile = (access_token) =>{
    return new Promise((resolve, reject) => {
      let url = 'https://api.mixin.one/me';
      let token ="";
      if(!access_token){
        const seconds = Math.floor(Date.now() / 1000);
        const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;
        let encrypted_pin = self.encryptPIN();
        let transfer_sig_str = "GET/me";
        let transfer_sig_sha256 = crypto.createHash('sha256').update(transfer_sig_str).digest("hex");

        let payload = {
          uid: self.client_id, //bot account id
          sid: self.session_id,
          iat: seconds ,
          exp: seconds_exp ,
          jti: self.uuidv4(),
          sig: transfer_sig_sha256
        };
        token = jwt.sign(payload, self.privatekey,{ algorithm: 'RS512'});
      } else {
        token= access_token;
      }

      let options ={
        url: url,
        method:"GET",
        headers: {
          'Authorization': 'Bearer '+token,
          'Content-Type' : 'application/json'
        }
      }
      request(options, function(err,httpResponse,body){
        requestHandler(err, body, resolve, reject);
      });

    });
  }

  self.readNetworkSnapshots = (offset, asset, limit, order) => {
    return new Promise((resolve, reject) => {
      let _order = "DESC";
      if(order)
        _order=order;

      let path = `/network/snapshots?limit=${limit}&offset=${offset}&order=${_order}`;
      if(asset && asset != "")
        path = path + `&asset=${asset}`;
      let url = "https://api.mixin.one"+path;
      let token = self.tokenGET(path,"");
      let options ={
        url: url,
        method:"GET",
        headers: {
          'Authorization': 'Bearer '+token,
          'Content-Type' : '0'
        }
      }
      request(options, function(err,httpResponse,body){
        requestHandler(err, body, resolve, reject);
      });
    });
  };

  self.readNetworkTransfer = (trace_id) => {
    return new Promise((resolve, reject) => {
      let path = `/transfers/trace/${trace_id}`;
      let url = "https://api.mixin.one"+path;
      let token = self.tokenGET(path,"");
      let options ={
        url: url,
        method:"GET",
        headers: {
          'Authorization': 'Bearer '+token,
          'Content-Type' : '0'
        }
      }
      request(options, function(err,httpResponse,body){
        requestHandler(err, body, resolve, reject);
      });
    });
  };

  self.requestAccessToken = (code) =>{
    return new Promise((resolve, reject) => {
      let auth_json = {
        client_id: self.client_id,
        code:  code,
        client_secret: self.client_secret
      };
      let auth_json_str = JSON.stringify(auth_json);
      let options ={
        url:'https://api.mixin.one/oauth/token',
        method:"POST",
        body: auth_json_str,
        headers: {
          'Content-Type' : 'application/json'
        }
      }
      request(options, function(err,httpResponse,body){
        requestHandler(err, body, resolve, reject);
      })
    });
  }


  self.jwtToken = (method, uri, body, opts) =>{
      let transfer_sig_str = method+uri+body;
      let transfer_sig_sha256 = crypto.createHash('sha256').update(transfer_sig_str).digest("hex");

      const seconds = Math.floor(Date.now() / 1000);
      let time = new Uint64LE(seconds);
      let seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;
      if(opts && opts.timeout)
        seconds_exp = Math.floor(Date.now() / 1000) + opts.timeout;

      let payload = {
        uid: self.client_id, //bot account id
        sid: self.session_id,
        iat: seconds ,
        exp: seconds_exp ,
        jti: self.uuidv4(),
        sig: transfer_sig_sha256
      };
      //console.log(payload);
      let token = jwt.sign(payload, self.privatekey,{ algorithm: 'RS512'});
      return token;
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
        let buf = new Buffer(JSON.stringify(message), 'utf-8');
        zlib.gzip(buf, function (_, zippedmsg) {
          if(self.ws.socket.readyState == WebSocket.OPEN){
            self.ws.send(zippedmsg);
            resolve();
          }else{
            reject("websocket_not_ready");
          }
        });
      } catch (err){
        reject(err);
      }
    });
  }

  self.send_ACKNOWLEDGE_MESSAGE_RECEIPT = (message_id) => {
    return new Promise((resolve, reject) => {
      try {
        let id = self.uuidv4();
        let message =  {
          "id": id,
          "action": "ACKNOWLEDGE_MESSAGE_RECEIPT",
          "params": {
            "message_id":message_id,
            "status": "READ"
          }
        }
        self.ws_send( message).then(function(){
          resolve(id);
        }).catch(function(err){
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
        let message =  {
          "id": id,
          "action": "LIST_PENDING_MESSAGES"
        }
        self.ws_send( message).then(function(){
          resolve(id);
        }).catch(function(err){
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  self.send_CREATE_MESSAGE = ( opts, msgobj) => {
    return new Promise((resolve, reject) => {
      try {
        let message_id = self.uuidv4();
        let params =  {"conversation_id": msgobj.data.conversation_id, "recipient_id":msgobj.data.user_id ,"message_id": message_id, "category": opts.category,"data":opts.data}
        let message = {id:self.uuidv4(), "action":"CREATE_MESSAGE", params:params }
        self.ws_send( message).then(function(){
          resolve(message_id);
        }).catch(function(err){
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  self.wsopts = () =>{
    let token = self.tokenGET("/","");
    let options = {
        headers: {
            "Authorization" : "Bearer " + token,
            "perMessageDeflate": false
        }
    }
    return options;
  }

  self.startws = () =>{
    self.ws = new wsreconnect('wss://blaze.mixin.one/', 'Mixin-Blaze-1',self, {});
    self.ws.on("error", (event) => {
      if(self.onError){
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

MIXINNODE.prototype.Assets= function(asset_id){
  return this.readAssets(asset_id);
}

MIXINNODE.prototype.readProfile = function(access_token){
  return this.readProfile (access_token);
}

MIXINNODE.prototype.transferFromBot = function(){
  return this.transferFromBot(asset_id, recipient_id, amount, memo);
}
MIXINNODE.prototype.authTokenGET = function(uri, body){
  return this.tokenGET(uri, body);
}
MIXINNODE.prototype.newuuid= function(){
  return this.uuidv4();
}

MIXINNODE.prototype.decode = function(data){
  return new Promise((resolve, reject) => {
    try{
      zlib.gunzip(data, function(err, dezipped) {
        let msgobj = JSON.parse(dezipped.toString());
        resolve(msgobj);
      })
    }catch(err){
      reject(err);
    }
  });
}

MIXINNODE.prototype.start= function(){
  return this.startws();
}

MIXINNODE.prototype.getwsopts = function(){
  return this.wsopts();
}

MIXINNODE.prototype.sendText = function( text, msgobj){
  let opts = {};
  opts.category = "PLAIN_TEXT";
  opts.data = new Buffer(text).toString('base64');
  return this.send_CREATE_MESSAGE(opts, msgobj);
}

MIXINNODE.prototype.sendImage= function( base64data, msgobj){
  let opts = {};
  opts.category = "PLAIN_IMAGE";
  opts.data = base64data;
  return this.send_CREATE_MESSAGE(opts, msgobj);
}

MIXINNODE.prototype.sendButton= function(text, msgobj){
  let opts = {};
  opts.category = "APP_BUTTON_GROUP";
  opts.data = new Buffer(text).toString('base64');
  return this.send_CREATE_MESSAGE(opts, msgobj);
}

MIXINNODE.prototype.sendMsg = function(action, opts){
  switch (action){
    case "ACKNOWLEDGE_MESSAGE_RECEIPT":
      return this.send_ACKNOWLEDGE_MESSAGE_RECEIPT(opts.message_id);
    case "LIST_PENDING_MESSAGES":
      return this.send_LIST_PENDING_MESSAGES();

    default:
      return "";
  }
}

MIXINNODE.prototype.requestAccessToken= function(code){
  return this.requestAccessToken(code);
}

MIXINNODE.prototype.readSnapshots= function(offset, asset, limit, order){
  return this.readNetworkSnapshots(offset, asset, limit, order);
}

MIXINNODE.prototype.readTransfer= function(trace_id){
  return this.readNetworkTransfer(trace_id);
}

MIXINNODE.prototype.getViewToken= function(uri, opts){
  return this.tokenGET(uri, "", opts);
}


MIXINNODE.prototype.signJWT= function(payload){
  let token = jwt.sign(payload, this.share_secret);
  return token;
}

MIXINNODE.prototype.startPullNetwork = function(timeinterval, opts, eventHandler){
  this.pullNetworkflag = true;
  interval(async (iteration, stop) => {
    if (this.pullNetworkflag == false) {
        stop()
    } else{

      let session = {};
      try{
        session = JSON.parse(fs.readFileSync('session.json', 'utf8'));
      }catch(err){
        if(opts.offset)
          session = {offset:offset};
        else {
          let current = new Date();
          session = {offset: current.toISOString()};
          let json = JSON.stringify(session);
          fs.writeFileSync('session.json', json, 'utf8');
        }
      }

      try {
        let results = await this.readNetworkSnapshots(
          rfc3339nano.adjustRfc3339ByNano(session.offset, 1),
          opts.asset_id, opts.limit, opts.order
        );
        results = results.data;
        for(let i in results){
          session.offset = results[i].created_at;
          if(results[i].user_id){
            eventHandler(results[i]);
          }

          let json = JSON.stringify(session);
          fs.writeFileSync('session.json', json, 'utf8');
        }
      } catch (err) {
        console.log(err);
      }

    }

  }, timeinterval) ;
}

MIXINNODE.prototype.stopPullNetwork= function(){
      this.pullNetworkflag = false;
}

module.exports = MIXINNODE;
