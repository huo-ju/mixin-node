const request = require('request');
const Uint64LE= require("int64-buffer").Uint64LE;
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const zlib = require("zlib"); 

let MIXINNODE = function(opts) {
  let self = this;

  opts = opts || {};
  self.pin= opts.pin;
  self.aeskey = opts.aeskey;
  self.client_id = opts.client_id;
  self.session_id = opts.session_id;

  if(typeof opts.privatekey == "string"){
    const cert = fs.readFileSync(opts.privatekey);
    self.privatekey = cert;
  } else if(typeof opts.privatekey == "object"){
    self.privatekey = opts.privatekey;
  }
  if(!self.pin || !self.aeskey || !self.client_id || !self.session_id || !self.privatekey){
    throw ("pin, aeskey, client_id, session_id, privatekey are require fields");
  }
  self.encryptPIN = () =>{
    const seconds = Math.floor(Date.now() / 1000);
    let time = new Uint64LE(seconds);
    let num = Date.now(); //TODO: read the global iterator value, and +1
    let iterator = new Uint64LE(num);
    let pin = Buffer.from( self.pin, 'utf8' )
    let toencrypt_pin_buff = Buffer.concat([pin, time.toBuffer() ,iterator.toBuffer()]);
    const aes_BlockSize  = 16;
    let padding = aes_BlockSize - toencrypt_pin_buff.length % aes_BlockSize;
    let padding_text_array = [];
    for(let i =0; i<padding;i++){
      padding_text_array.push(padding);
    }
    let padding_buffer = new Buffer(padding_text_array);
    let toencrypt_pin_buff_padding = Buffer.concat([toencrypt_pin_buff,padding_buffer]);
    let aeskeybase64 = self.aeskey;
    let aeskey= new Buffer(aeskeybase64, 'base64');
    let iv16  = crypto.randomBytes(16);
    let cipher = crypto.createCipheriv('aes-256-cbc', aeskey, iv16);
    cipher.setAutoPadding(false);
    let encrypted_pin_buff = cipher.update(toencrypt_pin_buff_padding,'utf-8');
    let encrypted_pin_with_irprefix= Buffer.concat([iv16 , encrypted_pin_buff]);
    let encrypted_pin = Buffer.from(encrypted_pin_with_irprefix).toString('base64')
    return encrypted_pin;
  }

  self.transferFromBot = (asset_id, recipient_id, amount, memo) => {
    return new Promise((resolve, reject) => {
      const seconds = Math.floor(Date.now() / 1000);
      const seconds_exp = Math.floor(Date.now() / 1000) + 900;
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
        uid: self.client_id, //"56304004-8095-4960-8dd1-edf6e583a2a9", //bot account id
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
        if(err){
          reject(err);
          // err   
        }else if(body.error){
          reject(JSON.parse(body.error));
          //err
        }else{
          resolve(JSON.parse(body));
        }
      })

    });
  }
  
  self.jwtToken = (method, uri, body) =>{
      let transfer_sig_str = method+uri+body;
      let transfer_sig_sha256 = crypto.createHash('sha256').update(transfer_sig_str).digest("hex");

      const seconds = Math.floor(Date.now() / 1000);
      let time = new Uint64LE(seconds);
      const seconds_exp = Math.floor(Date.now() / 1000) + 30;

      let payload = {
        uid: self.client_id, //bot account id
        sid: self.session_id, 
        iat: seconds ,
        exp: seconds_exp ,
        jti: self.uuidv4(),
        sig: transfer_sig_sha256
      };
      let token = jwt.sign(payload, self.privatekey,{ algorithm: 'RS512'});
      return token;
  }
  
  self.tokenGET = (uri, body) => {
    return this.jwtToken("GET", uri, body);
  }

  self.uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  self.ws_send = (ws, message) => {
    return new Promise((resolve, reject) => {
      try {
        let buf = new Buffer(JSON.stringify(message), 'utf-8');  
        zlib.gzip(buf, function (_, zippedmsg) { 
          ws.send(zippedmsg);
          resolve();
        });
      } catch (err){
        reject(err);
      }
    });
  }

  self.send_ACKNOWLEDGE_MESSAGE_RECEIPT = (ws, message_id) => {
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
        self.ws_send(ws, message).then(function(){
          resolve(id);
        }).catch(function(err){
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  self.send_LIST_PENDING_MESSAGES = (ws) => {
    return new Promise((resolve, reject) => {
      try {
        let id = self.uuidv4();
        let message =  {
          "id": id,
          "action": "LIST_PENDING_MESSAGES"
        }
        self.ws_send(ws, message).then(function(){
          resolve(id);
        }).catch(function(err){
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  self.send_CREATE_MESSAGE = (ws, opts, msgobj) => {
    return new Promise((resolve, reject) => {
      try {
        let message_id = self.uuidv4();
        let params =  {"conversation_id": msgobj.data.conversation_id, "recipient_id":msgobj.data.user_id ,"message_id": message_id, "category": opts.category,"data":opts.data}
        let message = {id:self.uuidv4(), "action":"CREATE_MESSAGE", params:params }
        self.ws_send(ws, message).then(function(){
          resolve(message_id);
        }).catch(function(err){
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  };

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

//{"conversation_id": in_conversation_id,"recipient_id":to_user_id ,"message_id":str(uuid.uuid4()),"category":"PLAIN_TEXT","data":base64.b64encode(textContent)}

MIXINNODE.prototype.sendText = function(ws, text, msgobj){
  let opts = {};
  opts.category = "PLAIN_TEXT";
  opts.data = new Buffer(text).toString('base64');
  return this.send_CREATE_MESSAGE(ws, opts, msgobj);
}

MIXINNODE.prototype.sendButton= function(ws, text, msgobj){
  let opts = {};
  opts.category = "APP_BUTTON_GROUP";
  opts.data = new Buffer(text).toString('base64');
  return this.send_CREATE_MESSAGE(ws, opts, msgobj);
}


MIXINNODE.prototype.sendMsg = function(ws, action, opts){
  switch (action){
    case "ACKNOWLEDGE_MESSAGE_RECEIPT":
      return this.send_ACKNOWLEDGE_MESSAGE_RECEIPT(ws, opts.message_id);
    case "LIST_PENDING_MESSAGES":
      return this.send_LIST_PENDING_MESSAGES(ws);
    //case "CREATE_MESSAGE":
    //  return this.send_CREATE_MESSAGE(ws, opts);

    default:
      return "";
  }

}

module.exports = MIXINNODE;
