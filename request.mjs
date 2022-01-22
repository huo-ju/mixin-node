import fetch from 'node-fetch';

export default function request(options, resolve, reject) {
  (async () => {
    try {
      const data = await fetch(options.url, options).then(res => res.json());
      if (data?.error) {
        throw Object.assign(new Error(
          data.error?.description || 'Error requesting Mixin service.'
        ), { raw: data.error });
      }
      resolve(data);
    } catch (err) { reject(err); }
  })();
};
