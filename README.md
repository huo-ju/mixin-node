# mixin-node
The nodejs SDK for mixin.one

- `This project is a pure ES6 module since version 2.`
- `This project requires Node.js v18 or above since version 2.5.`
- `This project now fully supports the new Ed25519 session.`

1. Following mixin developers documentation https://developers.mixin.one/guides create your mixin app.
2. Click the button "Ed25519 session". Now you will have the bot session secrets.
3. Save the session object and config it in your code.
4. Please see the transfer example in examples/test.js. Or here for reference:

```bash
npm install mixin-node --save
```

```javascript
import mixinjs from 'mixin-node';

const opts = {
  pin         : "854423",
  client_id   : "**********095-4960-8dd1-edf6e583a2a9",
  session_id  : "a335e1e3-eb33-4112-b30a-2ae287dfbe32",
  pin_token   : "*****DEN7P3k172oBLW3g/TUZa6Xa5MrgOOzKfXdv5A=",
  private_key : "*****-*******************************************************",
};

const mixin = new mixinjs(opts);
const asset_id = "965e5c6e-434c-3fa9-b780-c50f43cd955c"; //CNB
const recipient_id = "*************-4152-9c5a-839d286f7e4f"; //User Account ID
const amount = "100";
const memo ="test transfer"

mixin.transferFromBot(asset_id, recipient_id, amount, memo).then(console.log).catch(console.error);
```
-----------
## API

### websocket API
```javascript
mixin.onMessage = (data) => {
  mixin.decode(data).then(function(msgobj){
    return processing(msgobj);
  }).then(function(msgobj){
    mixin.sendMsg("LIST_PENDING_MESSAGES").then(function(receipt_id){
      console.log("list receipt_id:"+receipt_id);
    });
    mixin.sendText("my text",msgobj).then(function(receipt_id){
      console.log("text message receipt_id:"+receipt_id);
    });
    let authLink = "https://mixin.one/oauth/authorize?client_id=" + config.mixin.client_id + "&scope=PROFILE:READ";
    let btn = '[{"label":"auth","action":"' + authLink+ '","color":"#ff0033"}]'
    mixin.sendButton(btn, msgobj).then(function(result){
      console.log(result);
    });
  });
});
```

### RESTful API
```javascript
mixin.requestAccessToken(code).then(console.log);
```

-----------

1. 按照 mixin 开发者手册指引，建立app. https://developers.mixin.one/guides
2. 在 Dashboard 点击 "Ed25519 session"，记录下全部生成的信息。
3. 保存 session 對像並配置到你的代码中。
4. 通过机器人转账的例子代码

```bash
npm install mixin-node --save
```

```javascript
import mixinjs from 'mixin-node';

const opts = {
  pin         : "854423",
  client_id   : "**********095-4960-8dd1-edf6e583a2a9",
  session_id  : "a335e1e3-eb33-4112-b30a-2ae287dfbe32",
  pin_token   : "*****DEN7P3k172oBLW3g/TUZa6Xa5MrgOOzKfXdv5A=",
  private_key : "*****-*******************************************************",
};

const mixin = new mixinjs(opts);
const asset_id = "965e5c6e-434c-3fa9-b780-c50f43cd955c"; //CNB
const recipient_id = "*************-4152-9c5a-839d286f7e4f"; //User Account ID
const amount = "100";
const memo ="test transfer"

mixin.transferFromBot(asset_id, recipient_id, amount, memo).then(console.log).catch(console.error);
```
