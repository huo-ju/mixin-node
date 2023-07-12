import { sharedKey } from 'curve25519-js';
import crypto from 'crypto';
import forge from 'node-forge';
import fs from 'fs';
import int64Buffer from 'int64-buffer';
import jwt from 'jsonwebtoken';
import request from './request.mjs';

const { Uint64LE } = int64Buffer;
const algorithm = { algorithm: 'RS512', allowInsecureKeySizes: true };
const ed25519 = forge.pki.ed25519;
const rsa = forge.pki.rsa;

const ACCOUNT = function(opts) {
  let self = this;
  opts = opts || {};
  self.pin = opts.pin;
  self.aeskey = opts.aeskey;
  self.client_id = opts.client_id;
  self.session_id = opts.session_id;
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

  self.toBuffer = (content, encoding = 'utf8') => {
    if (typeof content === 'object') content = JSON.stringify(content)
    return Buffer.from(content, encoding)
  }

  self.base64url = (buffer) => {
    return buffer.toString('base64').replace(/\=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  }

  self.getEd25519Sign = (payload, privateKey) => {
    const header = self.toBuffer({ alg: 'EdDSA', typ: 'JWT' }).toString('base64')
    payload = self.base64url(self.toBuffer(payload))
    const result = [header, payload]
    const sign = self.base64url(forge.pki.ed25519.sign({
      message: result.join('.'), encoding: 'utf8', privateKey
    }))
    result.push(sign)
    return result.join('.');
  }

  self.getToken = (payload, privateKey) => {
    let _privateKey = self.toBuffer(privateKey, 'base64');
    return _privateKey.length === 64
      ? self.getEd25519Sign(payload, _privateKey)
      : jwt.sign(payload, privateKey, algorithm);
    // https://github.com/eclipse/microprofile-jwt-auth/issues/142
  };

  self.privateKeyToCurve25519 = (privateKey) => {
    const seed = privateKey.slice(0, 32)
    const sha512 = crypto.createHash('sha512')
    sha512.write(seed, 'binary')
    let digest = sha512.digest()
    digest[0] &= 248
    digest[31] &= 127
    digest[31] |= 64
    return digest.slice(0, 32)
  }

  self.signEncryptEd25519PIN = (pinToken, privateKey) => {
    pinToken = Buffer.from(pinToken, 'base64')
    privateKey = Buffer.from(privateKey, 'base64')
    privateKey = this.privateKeyToCurve25519(privateKey)
    return sharedKey(privateKey, pinToken);
  }

  self.updatePin = (oldpin, newpin, aeskeybase64, useroptions) => {
    return new Promise((resolve, reject) => {

      const seconds = Math.floor(Date.now() / 1000);
      const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;

      let encrypted_oldpin = oldpin;
      if (encrypted_oldpin != "")
        encrypted_oldpin = this.encryptCustomPIN(oldpin, aeskeybase64);

      let encrypted_pin = this.encryptCustomPIN(newpin, aeskeybase64);
      let pin_json =
      {
        pin: encrypted_pin,
        old_pin: encrypted_oldpin
      };

      let pin_json_str = JSON.stringify(pin_json);
      let pin_sig_str = "POST/pin/update" + pin_json_str;
      let pin_sig_sha256 = crypto.createHash('sha256').update(pin_sig_str).digest("hex");

      let client_id = self.client_id;
      if (useroptions.client_id)
        client_id = useroptions.client_id;

      let session_id = self.session_id;
      if (useroptions.session_id)
        session_id = useroptions.session_id;

      let privatekey = self.privatekey;
      if (useroptions.privatekey)
        privatekey = useroptions.privatekey;

      const payload = {
        uid: client_id, //bot account id
        sid: session_id,
        iat: seconds,
        exp: seconds_exp,
        jti: self.uuidv4(),
        sig: pin_sig_sha256,
        scp: 'FULL',
      };
      let options = {
        url: `${self.api_domain}/pin/update`,
        method: "POST",
        body: pin_json_str,
        headers: {
          'Authorization': 'Bearer ' + self.getToken(payload, privatekey),
          'Content-Type': 'application/json'
        }
      }
      request(options, resolve, reject);
    });
  };

  self.updateProfile = (profile, useroptions) => {
    return new Promise((resolve, reject) => {
      const seconds = Math.floor(Date.now() / 1000);
      const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;

      let profile_json_str = JSON.stringify(profile);
      let profile_sig_str = "POST/me" + profile_json_str;
      let profile_sig_sha256 = crypto.createHash('sha256').update(profile_sig_str).digest("hex");

      let client_id = self.client_id;
      if (useroptions.client_id)
        client_id = useroptions.client_id;

      let session_id = self.session_id;
      if (useroptions.session_id)
        session_id = useroptions.session_id;

      let privatekey = self.privatekey;
      if (useroptions.privatekey)
        privatekey = useroptions.privatekey;

      const payload = {
        uid: client_id, //bot account id
        sid: session_id,
        iat: seconds,
        exp: seconds_exp,
        jti: self.uuidv4(),
        sig: profile_sig_sha256,
        scp: 'FULL',
      };
      let options = {
        url: `${self.api_domain}/me`,
        method: "POST",
        body: profile_json_str,
        headers: {
          'Authorization': 'Bearer ' + self.getToken(payload, privatekey),
          'Content-Type': 'application/json'
        }
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

  self.readAssets = (asset_id, useroptions) => {
    // console.log(useroptions);
    return new Promise((resolve, reject) => {
      const seconds = Math.floor(Date.now() / 1000);
      const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;
      let transfer_sig_str = 'GET/assets';
      let url = `${self.api_domain}/assets`;
      if (asset_id && asset_id.length === 36) {
        transfer_sig_str = 'GET/assets/' + asset_id;
        url = `${self.api_domain}/assets/` + asset_id;
      }
      let transfer_sig_sha256 = crypto.createHash('sha256').update(transfer_sig_str).digest('hex');
      const payload = {
        uid: useroptions.client_id, // user account id
        sid: useroptions.session_id,
        iat: seconds,
        exp: seconds_exp,
        jti: self.uuidv4(),
        sig: transfer_sig_sha256,
        scp: 'FULL',
      };
      let options = {
        url: url,
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + self.getToken(payload, useroptions.privateKey),
          'Content-Type': 'application/json',
        }
      }
      request(options, resolve, reject);
    });
  };

  self.transfer = (asset_id, recipient_id, amount, memo, useroptions, trace_id) => {
    // console.log(useroptions);
    return new Promise((resolve, reject) => {
      const seconds = Math.floor(Date.now() / 1000);
      const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;
      if (!memo) {
        memo = '';
      }
      if (typeof amount === 'number') {
        amount = amount + '';
      }
      const aesKey = useroptions.aesKey || self.signEncryptEd25519PIN(
        useroptions.pin_token, useroptions.privateKey || useroptions.private_key
      );
      let encrypted_pin = self.encryptCustomPIN(useroptions.pin, aesKey);
      let transfer_json = {
        asset_id: asset_id,
        counter_user_id: recipient_id,
        amount: amount,
        pin: encrypted_pin,
        trace_id: trace_id || self.uuidv4(),
      };
      if (memo != '') {
        transfer_json['memo'] = memo;
      }
      let transfer_json_str = JSON.stringify(transfer_json);
      let transfer_sig_str = 'POST/transfers' + transfer_json_str;
      let transfer_sig_sha256 = crypto.createHash('sha256').update(
        transfer_sig_str
      ).digest('hex');
      const payload = {
        uid: useroptions.client_id, // sender account id
        sid: useroptions.session_id,
        iat: seconds,
        exp: seconds_exp,
        jti: self.uuidv4(),
        sig: transfer_sig_sha256,
        scp: 'FULL',
      };
      let options = {
        url: `${self.api_domain}/transfers`,
        method: 'POST',
        body: transfer_json_str,
        headers: {
          'Authorization': 'Bearer ' + self.getToken(payload, useroptions.private_key || useroptions.privateKey),
          'Content-Type': 'application/json',
        },
      }
      request(options, resolve, reject);
    });
  };

  // https://developers.mixin.one/docs/api/transfer/raw-transfer
  // {
  //   "asset_id":     "the asset's asset_id which you are transferring",
  //   "opponent_id":  "the mainnet address which you are transferring",
  //   "amount":       "e.g.: "0.01", supports up to 8 digits after the decimal point",
  //   "pin":          "Encrypted PIN",
  //   "trace_id":     "Used to prevent duplicate payment, optional",
  //   "memo":         "Maximally 140 characters, optional",
  // }
  // {
  //   "asset_id": "the asset's asset_id which you are transferring",
  //   "opponent_multisig": { // "the multi-signature object, identify the address which you are transferring",
  //     "receivers": [
  //       "user_id",
  //       "user_id",
  //       "...",
  //     ],
  //     "threshold": 3
  //   },
  //   "amount": "e.g.: "0.01", supports up to 8 digits after the decimal point",
  //   "pin": "Encrypted PIN",
  //   "trace_id": "Used to prevent duplicate payment, optional",
  //   "memo": "Maximally 140 characters, optional",
  // }
  self.rawTransfer = (asset_id, opponent_id, opponent_multisig, amount, memo, useroptions, trace_id) => {
    // console.log(useroptions);
    return new Promise((resolve, reject) => {
      const api = '/transactions';
      if (!memo) { memo = ''; }
      if (typeof amount === 'number') { amount = amount + ''; }
      const aesKey = useroptions.aesKey || self.signEncryptEd25519PIN(
        useroptions.pin_token, useroptions.privateKey || useroptions.private_key
      );
      const transfer_json = {
        asset_id, amount, trace_id: trace_id || self.uuidv4(),
        pin: self.encryptCustomPIN(useroptions.pin, aesKey),
      };
      if (opponent_id) { transfer_json.opponent_id = opponent_id; }
      else if (opponent_multisig) { transfer_json.opponent_multisig = opponent_multisig; }
      if (memo != '') { transfer_json['memo'] = memo; }
      const body = JSON.stringify(transfer_json);
      const payload = {
        uid: useroptions.client_id, // sender account id
        sid: useroptions.session_id,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + self.timeout,
        jti: self.uuidv4(),
        sig: crypto.createHash('sha256').update(`POST${api}${body}`).digest('hex'),
        scp: 'FULL',
      };
      const options = {
        url: `${self.api_domain}${api}`,
        method: 'POST',
        body,
        headers: {
          'Authorization': 'Bearer ' + self.getToken(payload, useroptions.private_key || useroptions.privateKey),
          'Content-Type': 'application/json',
        },
      }
      request(options, resolve, reject);
    });
  };

  self.encryptCustomPIN = (pincode, aeskeybase64) => {
    const seconds = Math.floor(Date.now() / 1000);
    let time = new Uint64LE(seconds);
    let num = Date.now(); //TODO: read the global iterator value, and +1
    let iterator = new Uint64LE(num);
    let pin = Buffer.from(pincode, 'utf8')
    let toencrypt_pin_buff = Buffer.concat([pin, time.toBuffer(), iterator.toBuffer()]);
    const aes_BlockSize = 16;
    let padding = aes_BlockSize - toencrypt_pin_buff.length % aes_BlockSize;
    let padding_text_array = [];
    for (let i = 0; i < padding; i++) {
      padding_text_array.push(padding);
    }
    let padding_buffer = Buffer.from(padding_text_array);
    let toencrypt_pin_buff_padding = Buffer.concat([toencrypt_pin_buff, padding_buffer]);
    let aeskey = Buffer.from(aeskeybase64, 'base64');
    let iv16 = crypto.randomBytes(16);
    let cipher = crypto.createCipheriv('aes-256-cbc', aeskey, iv16);
    cipher.setAutoPadding(false);
    let encrypted_pin_buff = cipher.update(toencrypt_pin_buff_padding, 'utf-8');
    let encrypted_pin_with_irprefix = Buffer.concat([iv16, encrypted_pin_buff]);
    let encrypted_pin = Buffer.from(encrypted_pin_with_irprefix).toString('base64')
    return encrypted_pin;
  }

  self.createUser = (username, keytype = 'RSA') => { // keep the RSA as default to avoid breaking compatibility
    return new Promise((resolve, reject) => {
      let generateKeyPair, key, pubkeystring;
      switch ((keytype = String(keytype).toUpperCase())) {
        case 'RSA':
          generateKeyPair = rsa.generateKeyPair;
          break;
        case 'ED25519':
          generateKeyPair = (_, cb) => { cb(null, ed25519.generateKeyPair()); };
          break;
        default:
          reject('Invalid key type');
      }
      generateKeyPair({ bits: 1024, workers: 2 }, function(_, keypair) {
        switch (keytype) {
          case 'RSA':
            key = {
              publickey: forge.pki.publicKeyToPem(keypair.privateKey),
              privatekey: forge.pki.privateKeyToPem(keypair.privateKey)
            };
            let lines = key.publickey.trim().split("\n");
            lines.splice(lines.length - 1, 1);
            lines.splice(0, 1);
            let resultline = lines.map(function(x) { return x.trim(); });
            pubkeystring = resultline.join('');
            break;
          case 'ED25519':
            key = {
              publickey: keypair.publicKey.toString('base64'),
              privatekey: keypair.privateKey.toString('base64'),
            };
            pubkeystring = key.publickey;
            break;
        }
        let createuser_json = {};
        createuser_json["session_secret"] = pubkeystring;
        createuser_json["full_name"] = username;
        let createuser_json_str = JSON.stringify(createuser_json);
        let createuser_sig_str = "POST/users" + createuser_json_str;
        let createuser_sig_sha256 = crypto.createHash('sha256').update(createuser_sig_str).digest("hex");
        const seconds = Math.floor(Date.now() / 1000);
        const seconds_exp = Math.floor(Date.now() / 1000) + self.timeout;
        let payload = {
          uid: self.client_id, //bot account id
          sid: self.session_id,
          iat: seconds,
          exp: seconds_exp,
          jti: self.uuidv4(),
          sig: createuser_sig_sha256,
          scp: 'FULL',
        };
        let options = {
          url: `${self.api_domain}/users`,
          method: "Post",
          body: createuser_json_str,
          headers: {
            'Authorization': 'Bearer ' + self.getToken(payload, self.privatekey),
            'Content-Type': 'application/json'
          }
        }
        request(options, (result) => {
          result.privatekey = key.privatekey;
          result.publickey = key.publickey;
          switch ((result.keytype = keytype)) {
            case 'RSA':
              result.data.aeskeybase64 = self.decryptRSAOAEP(key.privatekey, result.data.pin_token, result.data.session_id);
              break;
            case 'ED25519':
              result.data.aeskeybase64 = self.signEncryptEd25519PIN(result.data.pin_token, keypair.privateKey);
              break;
          }
          resolve(result);
        }, reject);
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
    let buf = Buffer.from(message, 'base64');
    let decrypted = privateKey.decrypt(buf, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      label: label
    });
    let s = Buffer.from(decrypted, 'binary').toString('base64');
    return s;
  }

}

ACCOUNT.getToken = function(payload, privateKey) {
  return self.getToken(payload, privateKey);
};

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

export default ACCOUNT;
