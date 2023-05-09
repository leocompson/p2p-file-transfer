/* global SAFE */

'use strict';

const SAFE = {};

window.SAFE = SAFE;

{
  let _key = '';
  //
  const _iv = crypto.getRandomValues(new Uint8Array(16));
  const _toString = buffer => [...buffer].map(b => String.fromCharCode(b)).join('');
  const _toBuffer = str => {
    const bytes = new Uint8Array(str.length);
    [...str].forEach((c, i) => bytes[i] = c.charCodeAt(0));
    return bytes;
  };
  //
  SAFE.password = async password => {
    _key = await crypto.subtle.digest({'name': 'SHA-256'}, _toBuffer(password)).then(result => crypto.subtle.importKey('raw', result, {'name': 'AES-CBC'}, false, ['encrypt', 'decrypt']));
  };
  //
  SAFE.decrypt = async data => {
    const result = await crypto.subtle.decrypt({'iv': _iv, 'name': 'AES-CBC'}, _key, _toBuffer(atob(data.split(',')[1])));
    return _toString((new Uint8Array(result)).subarray(16));
  };
  //
  SAFE.encrypt = async data => {
    const result = await crypto.subtle.encrypt({'iv': _iv, 'name': 'AES-CBC'}, _key, _toBuffer(data));
    //
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(new Blob([_iv, result], {'type': 'application/octet-binary'}));
    });
  };
}