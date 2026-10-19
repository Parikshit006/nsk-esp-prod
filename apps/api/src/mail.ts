import nodemailer from 'nodemailer';
import type { Config } from './config.js';

export type RecoverySender=(email:string,link:string)=>Promise<void>;
export function recoverySender(config:Config):RecoverySender {
  return async(email,link)=>{
    if(!config.SMTP_HOST||!config.SMTP_USER||!config.SMTP_PASSWORD||!config.SMTP_FROM) throw new Error('SMTP is not configured');
    const transport=nodemailer.createTransport({
      host:config.SMTP_HOST,port:config.SMTP_PORT,secure:config.SMTP_SECURE==='true',
      requireTLS:config.SMTP_SECURE!=='true',auth:{user:config.SMTP_USER,pass:config.SMTP_PASSWORD},
      connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true
    });
    try {await transport.sendMail({from:config.SMTP_FROM,to:email,subject:'Reset your Tournament Operations password',
      text:`A password reset was requested for this account. Open this link within 30 minutes:\n${link}\n\nIf you did not request this, you can ignore this message.`});}
    finally {transport.close();}
  };
}
export function verificationSender(config:Config):RecoverySender {
  return async(email,link)=>{
    if(!config.SMTP_HOST||!config.SMTP_USER||!config.SMTP_PASSWORD||!config.SMTP_FROM) throw new Error('SMTP is not configured');
    const transport=nodemailer.createTransport({
      host:config.SMTP_HOST,port:config.SMTP_PORT,secure:config.SMTP_SECURE==='true',
      requireTLS:config.SMTP_SECURE!=='true',auth:{user:config.SMTP_USER,pass:config.SMTP_PASSWORD},
      connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true
    });
    try {await transport.sendMail({from:config.SMTP_FROM,to:email,subject:'Verify your Tournament Operations email',
      text:`Open this link within 24 hours to verify your email address:\n${link}\n\nIf you did not create this account, you can ignore this message.`});}
    finally {transport.close();}
  };
}
