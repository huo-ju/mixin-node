1. Following mixin developers documentation https://developers.mixin.one/guides create your mixin app.
2. Click the button "Click to generate a new session". Now you will now have the bot session secrets.

The 6 digit number is your asset PIN
The UUID is the new session ID 
The third line is the encrypted PIN_TOKEN
The RSA PRIVATE KEY is your session KEY, please save the private Key as a file.

3. decrypt the PIN_TOKEN using tools/decryptkey.go

go run tools/decryptkey.go -key mixin.key -label ********-eb33-4112-b30a-2ae287dfbe32 -message **********OIGnELd1XnAFXec6WQJC4QtN0jZaWVBTQXk9okH9UfOzxfCdA2lGzZik3VeFC6TPqyiCM61JRSqt/uSbCzPWm7+2Svb56YRCK8jmmH7Fpy33F4grZfYx7r8AxY8Nm9A8xv+tSh2sSaUZGK0W4lFKnA/WEKkIwkzEM=

key is the filename of the private key 
label is the session ID
message is the PIN_TOKEN

Then you have the decrypted string which is the aeskey.


4. Please see the transfer example in examples/test.js. Or here for reference:

npm install mixin-node --save

const mixinjs = require('mixin-node');  
let opts = { 
    client_id         : "**********095-4960-8dd1-edf6e583a2a9",
    aeskey            : "*****DEN7P3k172oBLW3g/TUZa6Xa5MrgOOzKfXdv5A=",
    pin               : "854423",
    session_id    : "a335e1e3-eb33-4112-b30a-2ae287dfbe32",
    privatekey    : "mixin_dev.key"
}

var asset_id = "965e5c6e-434c-3fa9-b780-c50f43cd955c"; //CNB
var recipient_id = "*************-4152-9c5a-839d286f7e4f"; //User Account ID
var amount = "100";
var memo ="test transfer"

mixin.transferFromBot(asset_id, recipient_id, amount, memo)
.then( (result) =>{
  console.log(result);
}).catch( (err) => {
  console.log(err);
});

-----------

1. 按照mixin开发者手册指引，建立app. https://developers.mixin.one/guides
2. 在Dashboard 点击 Click to generate a new session，记录下全部生成的信息。

第一行的 6 位数字是 api接入 的提现/转账PIN 码，此处也是机器人的提现/转账密码
第二行的 UUID 是 session ID，
第三行是PIN_TOKEN，

最后一部分 RSA PRIVATE KEY 是跟 API 进行交互时用来签名 JWT 的私钥，请把这部分保存成一个单独的文件，比如叫做 mixin.key

3. 解密获得aeskey，在本repo的tools下提供了一个decryptkey.go这个工具用于解密

go run tools/decryptkey.go -key mixin.key -label a335e1e3-eb33-4112-b30a-2ae287dfbe32 -message WPdPdXnIM1OIGnELd1XnAFXec6WQJC4QtN0jZaWVBTQXk9okH9UfOzxfCdA2lGzZik3VeFC6TPqyiCM61JRSqt/uSbCzPWm7+2Svb56YRCK8jmmH7Fpy33F4grZfYx7r8AxY8Nm9A8xv+tSh2sSaUZGK0W4lFKnA/WEKkIwkzEM=

key 是前面保存的PRIVATE KEY的文件名，比如mixin.key
label 是第2步中的session ID
message 是第2步中的第三行，PIN_TOKEN

运行之后会获得解密的aeskey

4. 通过机器人转账的例子代码

npm install mixin-node --save

const mixinjs = require('mixin-node');  
let opts = { 
    client_id         : "**********095-4960-8dd1-edf6e583a2a9",
    aeskey            : "*****DEN7P3k172oBLW3g/TUZa6Xa5MrgOOzKfXdv5A=",
    pin               : "854423",
    session_id    : "a335e1e3-eb33-4112-b30a-2ae287dfbe32",
    privatekey    : "mixin_dev.key"
}

var asset_id = "965e5c6e-434c-3fa9-b780-c50f43cd955c"; //CNB
var recipient_id = "*************-4152-9c5a-839d286f7e4f"; //User Account ID
var amount = "100";
var memo ="test transfer"

mixin.transferFromBot(asset_id, recipient_id, amount, memo)
.then( (result) =>{
  console.log(result);
}).catch( (err) => {
  console.log(err);
});
