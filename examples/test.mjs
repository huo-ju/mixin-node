import config from './config.mjs';
import mixinjs from '../index.mjs';

// import fs from 'fs';
// const cert = fs.readFileSync(config.mixin.privatekey);
const opts = config.mixin;
const mixin = new mixinjs(opts);
const asset_id = "965e5c6e-434c-3fa9-b780-c50f43cd955c"; //CNB
const recipient_id = "********-9d0b-4152-9c5a-839d286f7e4f"; //Account ID
const amount = "100.022";
const memo = "test transfer";

mixin.transferFromBot(asset_id, recipient_id, amount, memo)
    .then(console.log)
    .catch(console.error);

try {
    const x = await mixin.account.readAssets(asset_id, {
        client_id: 'xxxxxxxx-d8e3-3631-981d-b6b81ff5e594',
        session_id: 'xxxxxxxx-439a-4cd1-9082-50f79853ed97',
        privatekey: "-----BEGIN RSA PRIVATE KEY-----\r\nxxxxxxxxxxxxxxxxxxxx9MGgcg3ai9XcM5wA2UCn1cw4Fe3j+5s6n7QOriQtohNs\r\nr3B+s3B6+ALUd8a4CbGT8EF1GbU7+fMTU7mink/tUgPRv2uRFFUgG61yYWAVYm+d\r\n0evrS/qDFMR6FfnC02cYXnk6qyHPBREwCYEZ3cXiwtoVUjWbtn1+dw+DzQIDAQAB\r\nAoGAVq+kQ7rYkLMc856oWxTPuQvPippS7lQrvcgUyALnIEY8YoT7beefXBxo2Whr\r\no4IeLaskVCuanzBkf3bxWHG6Ma/KzD7S+aqHjWMSyQLebb1onnHzfGAto+psYo9w\r\nwzO0XaoRuZI/aX7QJTlNh8iC1XBF4BBTJSeb91OTzsBdIUECQQDsoQ2x/QPIU35W\r\nF+9xvDpqM1OJkEYWZgM+tQFVGAoQI1pCSKjPbQa2qaSPxoEU5LGRQJ53EZLNJNfI\r\nqs6yHyudAkEAtq2tvJid8R6SYnHIKKglaKSa/fNvafDXMp8AmOlfPeFLPyNalNSd\r\nVf6uvBgRktcOjyoGwv1Xk8e0oY0Ajw+58QJBAJef03C7mZLhvVBZYfrVC/FFFkBN\r\njDuJ/oZN4Z6vGrOgk5Npj5HqYKTnKyVdoxTKPeW/LEtLnW+KLiLNIEkOpBkCQHNS\r\nz3RZMJRQhX8qb37jL8KQ79vT+4j45xHo+PqPkXXCLbutOPjuBGmOf4b09tspcuKE\r\nWIJuZwQ/NdQq7Khj+DECQCJ0P+zNELfyaz9k7vXvIBi4ef02sNalhOxDW2fOm6t1\r\nrl5hdmet78yyCov2DtzrSMG4HItu/q1zP4ldaqUI98A=\r\n-----END RSA PRIVATE KEY-----\r\n",
    });
    console.log(x);
    const y = await mixin.account.transfer(
        asset_id, '36029b33-838f-4dbe-ae9b-f0e86226d53d', '1', 'testing', {
        pin: '******',
        aesKey: 'xxxxxxxxxxxxxxxxxZ4r1tFg16HxKascYWyMCAK7t28=',
        client_id: 'xxxxxxxx-d8e3-3631-981d-b6b81ff5e594',
        session_id: 'xxxxxxxx-439a-4cd1-9082-50f79853ed97',
        privatekey: "-----BEGIN RSA PRIVATE KEY-----\r\nxxxxxxxxxxxxxxxxxxxx9MGgcg3ai9XcM5wA2UCn1cw4Fe3j+5s6n7QOriQtohNs\r\nr3B+s3B6+ALUd8a4CbGT8EF1GbU7+fMTU7mink/tUgPRv2uRFFUgG61yYWAVYm+d\r\n0evrS/qDFMR6FfnC02cYXnk6qyHPBREwCYEZ3cXiwtoVUjWbtn1+dw+DzQIDAQAB\r\nAoGAVq+kQ7rYkLMc856oWxTPuQvPippS7lQrvcgUyALnIEY8YoT7beefXBxo2Whr\r\no4IeLaskVCuanzBkf3bxWHG6Ma/KzD7S+aqHjWMSyQLebb1onnHzfGAto+psYo9w\r\nwzO0XaoRuZI/aX7QJTlNh8iC1XBF4BBTJSeb91OTzsBdIUECQQDsoQ2x/QPIU35W\r\nF+9xvDpqM1OJkEYWZgM+tQFVGAoQI1pCSKjPbQa2qaSPxoEU5LGRQJ53EZLNJNfI\r\nqs6yHyudAkEAtq2tvJid8R6SYnHIKKglaKSa/fNvafDXMp8AmOlfPeFLPyNalNSd\r\nVf6uvBgRktcOjyoGwv1Xk8e0oY0Ajw+58QJBAJef03C7mZLhvVBZYfrVC/FFFkBN\r\njDuJ/oZN4Z6vGrOgk5Npj5HqYKTnKyVdoxTKPeW/LEtLnW+KLiLNIEkOpBkCQHNS\r\nz3RZMJRQhX8qb37jL8KQ79vT+4j45xHo+PqPkXXCLbutOPjuBGmOf4b09tspcuKE\r\nWIJuZwQ/NdQq7Khj+DECQCJ0P+zNELfyaz9k7vXvIBi4ef02sNalhOxDW2fOm6t1\r\nrl5hdmet78yyCov2DtzrSMG4HItu/q1zP4ldaqUI98A=\r\n-----END RSA PRIVATE KEY-----\r\n",
    });
    console.log(y);
} catch (err) {
    console.error(err);
}
