const Uint64LE= require("int64-buffer").Uint64LE;
const crypto = require('crypto');
const request = require('request');
const fs = require('fs');
const forge = require('node-forge');
const rsa = forge.pki.rsa;
const jwt = require('jsonwebtoken');

let ACCOUNT = function(opts) {
  let self = this;
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

  self.updatePin = (oldpin, newpin, aeskeybase64, useroptions) => {
    return new Promise((resolve, reject) => {

      const seconds = Math.floor(Date.now() / 1000);
      const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;

      let encrypted_oldpin = oldpin;
      if(encrypted_oldpin!="")
        encrypted_oldpin = this.encryptCustomPIN(oldpin, aeskeybase64);

      let encrypted_pin= this.encryptCustomPIN(newpin, aeskeybase64);
      let pin_json =
      {
        pin:      encrypted_pin,
        old_pin: encrypted_oldpin
      };

      let pin_json_str = JSON.stringify(pin_json);
      let pin_sig_str = "POST/pin/update"+pin_json_str;
      let pin_sig_sha256 = crypto.createHash('sha256').update(pin_sig_str).digest("hex");

      let client_id = self.client_id;
      if(useroptions.client_id)
        client_id = useroptions.client_id;

      let session_id = self.session_id;
      if(useroptions.session_id)
        session_id = useroptions.session_id;

      let privatekey = self.privatekey;
      if(useroptions.privatekey)
        privatekey = useroptions.privatekey;

      let payload = {
        uid: client_id, //bot account id
        sid: session_id,
        iat: seconds ,
        exp: seconds_exp ,
        jti: self.uuidv4(),
        sig: pin_sig_sha256
      };
      let token = jwt.sign(payload, privatekey,{ algorithm: 'RS512'});
      let options ={
        url:'https://api.mixin.one/pin/update',
        method:"POST",
        body: pin_json_str,
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
  };

  self.updateProfile = (profile, useroptions) => {
    return new Promise((resolve, reject) => {
      const seconds = Math.floor(Date.now() / 1000);
      const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;

      let profile_json_str = JSON.stringify(profile);
      let profile_sig_str = "POST/me"+profile_json_str;
      let profile_sig_sha256 = crypto.createHash('sha256').update(profile_sig_str).digest("hex");

      let client_id = self.client_id;
      if(useroptions.client_id)
        client_id = useroptions.client_id;

      let session_id = self.session_id;
      if(useroptions.session_id)
        session_id = useroptions.session_id;

      let privatekey = self.privatekey;
      if(useroptions.privatekey)
        privatekey = useroptions.privatekey;

      let payload = {
        uid: client_id, //bot account id
        sid: session_id,
        iat: seconds ,
        exp: seconds_exp ,
        jti: self.uuidv4(),
        sig: profile_sig_sha256
      };
      let token = jwt.sign(payload, privatekey,{ algorithm: 'RS512'});
      let options ={
        url:'https://api.mixin.one/me',
        method:"POST",
        body: profile_json_str,
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
  };

  self.readAssets = (asset_id, useroptions) => {
    // console.log(useroptions);
    return new Promise((resolve, reject) => {
      const seconds        = Math.floor(Date.now() / 1000);
      const seconds_exp    = Math.floor(Date.now() / 1000) + self.timeout;
      let transfer_sig_str = 'GET/assets';
      let url = 'https://api.mixin.one/assets';
      if (asset_id && asset_id.length === 36) {
        transfer_sig_str = 'GET/assets/' + asset_id;
        url = 'https://api.mixin.one/assets/' + asset_id;
      }
      let transfer_sig_sha256 = crypto.createHash('sha256').update(transfer_sig_str).digest('hex');
      let payload = {
        uid : useroptions.client_id, // user account id
        sid : useroptions.session_id,
        iat : seconds,
        exp : seconds_exp,
        jti : self.uuidv4(),
        sig : transfer_sig_sha256,
      };
      let token   = jwt.sign(
        payload, useroptions.privateKey, {algorithm : 'RS512'}
      );
      let options = {
        url     : url,
        method  : 'GET',
        headers : {
          'Authorization' : 'Bearer ' + token,
          'Content-Type'  : 'application/json',
        }
      }
      request(options, (err, httpResponse, body) => {
        if (err) {
          reject(err);
          // err
        } else if (body.error) {
          reject(JSON.parse(body.error));
          //err
        } else {
          resolve(JSON.parse(body));
        }
      })
    });
  };

  self.transfer = (asset_id, recipient_id, amount, memo, useroptions, trace_id) => {
    // console.log(useroptions);
    return new Promise((resolve, reject) => {
      const seconds     = Math.floor(Date.now() / 1000);
      const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;
      if (!memo) {
        memo = '';
      }
      if (typeof amount === 'number') {
        amount = amount + '';
      }
      let encrypted_pin = self.encryptCustomPIN(
        useroptions.pin, useroptions.aesKey
      );
      let transfer_json = {
        asset_id        : asset_id,
        counter_user_id : recipient_id,
        amount          : amount,
        pin             : encrypted_pin,
        trace_id        : trace_id || self.uuidv4(),
      };
      if (memo != '') {
        transfer_json['memo'] = memo;
      }
      let transfer_json_str   = JSON.stringify(transfer_json);
      let transfer_sig_str    = 'POST/transfers' + transfer_json_str;
      let transfer_sig_sha256 = crypto.createHash('sha256').update(
        transfer_sig_str
      ).digest('hex');
      let payload = {
        uid : useroptions.client_id, // sender account id
        sid : useroptions.session_id,
        iat : seconds,
        exp : seconds_exp ,
        jti : self.uuidv4(),
        sig : transfer_sig_sha256,
      };
      let token = jwt.sign(
        payload, useroptions.privateKey, {algorithm : 'RS512'}
      );
      let options = {
        url     : 'https://api.mixin.one/transfers',
        method  : 'POST',
        body    : transfer_json_str,
        headers : {
          'Authorization' : 'Bearer ' + token,
          'Content-Type'  : 'application/json',
        },
      }
      request(options, function(err, httpResponse, body) {
        if (err) {
          reject(err);
          // err
        } else if (body.error) {
          reject(JSON.parse(body.error));
          //err
        } else {
          resolve(JSON.parse(body));
        }
      })
    });
  };

  self.encryptCustomPIN = (pincode, aeskeybase64) =>{
    const seconds = Math.floor(Date.now() / 1000);
    let time = new Uint64LE(seconds);
    let num = Date.now(); //TODO: read the global iterator value, and +1
    let iterator = new Uint64LE(num);
    let pin = Buffer.from(pincode, 'utf8' )
    let toencrypt_pin_buff = Buffer.concat([pin, time.toBuffer() ,iterator.toBuffer()]);
    const aes_BlockSize  = 16;
    let padding = aes_BlockSize - toencrypt_pin_buff.length % aes_BlockSize;
    let padding_text_array = [];
    for(let i = 0; i<padding;i++){
      padding_text_array.push(padding);
    }
    let padding_buffer = Buffer.from(padding_text_array);
    let toencrypt_pin_buff_padding = Buffer.concat([toencrypt_pin_buff,padding_buffer]);
    let aeskey = Buffer.from(aeskeybase64, 'base64');
    let iv16   = crypto.randomBytes(16);
    let cipher = crypto.createCipheriv('aes-256-cbc', aeskey, iv16);
    cipher.setAutoPadding(false);
    let encrypted_pin_buff = cipher.update(toencrypt_pin_buff_padding,'utf-8');
    let encrypted_pin_with_irprefix= Buffer.concat([iv16 , encrypted_pin_buff]);
    let encrypted_pin = Buffer.from(encrypted_pin_with_irprefix).toString('base64')
    return encrypted_pin;
  }

  self.createUser = (username) =>{
    return new Promise((resolve, reject) => {

    const rsa = forge.pki.rsa;
    rsa.generateKeyPair({bits: 1024, workers: 2}, function(err, keypair) {
      let key= {
        publickeypem: forge.pki.publicKeyToPem(keypair.privateKey),
        privatekeypem: forge.pki.privateKeyToPem(keypair.privateKey)
      };

      let lines = key.publickeypem.trim().split("\n");
      lines.splice(lines.length-1, 1);
      lines.splice(0, 1);
      let resultline = lines.map(function(x){return x.trim();});
      let pubkeystring = resultline.join('');

      let createuser_json = {};
      createuser_json["session_secret"] = pubkeystring;
      createuser_json["full_name"] = username;
      let createuser_json_str = JSON.stringify(createuser_json);
      let createuser_sig_str = "POST/users"+createuser_json_str;
      let createuser_sig_sha256 = crypto.createHash('sha256').update(createuser_sig_str).digest("hex");

      const seconds = Math.floor(Date.now() / 1000);
      const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;

      let payload = {
        uid: self.client_id, //bot account id
        sid: self.session_id,
        iat: seconds ,
        exp: seconds_exp ,
        jti: self.uuidv4(),
        sig: createuser_sig_sha256
      };
      let token = jwt.sign(payload, self.privatekey,{ algorithm: 'RS512'});
      let options ={
        url:'https://api.mixin.one/users',
        method:"Post",
        body: createuser_json_str,
        headers: {
          'Authorization': 'Bearer '+token,
          'Content-Type' : 'application/json'
        }
      }
      request(options, function(err,httpresponse,body){
        if(err){
          reject(err);
        }else if(body.error){
          reject(JSON.parse(body.error));
        }else{
          var result = {};
          result.privatekey = key.privatekeypem;
          result.publickey = key.publickeypem;
          result.data = JSON.parse(body).data;
          result.data.aeskeybase64 = self.decryptRSAOAEP(key.privatekeypem, result.data.pin_token, result.data.session_id);
          resolve(result);
        }
      });
    });
  });
  }

  self.uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  self.decryptRSAOAEP = (privateKeyPem, message, label) => {
    let pki = forge.pki;
    let privateKey = pki.privateKeyFromPem(privateKeyPem);
    let buf = new Buffer(message, 'base64');
    let decrypted = privateKey.decrypt(buf, 'RSA-OAEP',{
      md: forge.md.sha256.create(),
      label: label
    });
    let s = new Buffer(decrypted, 'binary').toString('base64');
    return s;
  }

}

ACCOUNT.encryptCustomPIN = function(pincode, aeskeybase64) {
  return self.encryptCustomPIN(pincode, aeskeybase64);
}

ACCOUNT.prototype.createUser = function(username) {
  return this.createUser(username);
}

ACCOUNT.prototype.readAssets = function(asset_id, aeskeybase64, useroptions) {
  return this.readAssets(asset_id, aeskeybase64, useroptions);
}

ACCOUNT.prototype.decryptRSAOAEP = function(privateKey, message, label) {
  return this.decryptRSAOAEP(privateKey, message, label);
}

ACCOUNT.prototype.updatePin = function(oldpin, newpin, aeskeybase64, options) {
  return this.updatePin(oldpin, newpin, aeskeybase64, options);
}

ACCOUNT.prototype.updateProfile = function(profile, options) {
  return this.updateProfile(profile, options);
}

module.exports = ACCOUNT;
