import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';

export type RoomDetails={room_id:string;password:string};
export type EncryptedRoom={iv:Buffer;ciphertext:Buffer;auth_tag:Buffer};
export function encryptRoom(key:Buffer,value:RoomDetails):EncryptedRoom{
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  return {iv,ciphertext:Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]),auth_tag:cipher.getAuthTag()};
}
export function decryptRoom(key:Buffer,value:EncryptedRoom):RoomDetails{
  const decipher=createDecipheriv('aes-256-gcm',key,value.iv);decipher.setAuthTag(value.auth_tag);
  const decoded=JSON.parse(Buffer.concat([decipher.update(value.ciphertext),decipher.final()]).toString('utf8')) as RoomDetails;
  if(typeof decoded.room_id!=='string'||typeof decoded.password!=='string')throw new Error('Invalid room details');
  return decoded;
}
export function decryptWithFallback(current:Buffer,previous:Buffer|null,value:EncryptedRoom){
  try{return decryptRoom(current,value);}catch(error){if(!previous)throw error;return decryptRoom(previous,value);}
}
