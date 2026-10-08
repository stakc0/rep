import Busboy from 'busboy';
import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } from '@solana/web3.js';
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, NATIVE_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { OnlinePumpSdk, PUMP_SDK, getBuyTokenAmountFromSolAmount } = require('@pump-fun/pump-sdk');

const TREASURY = new PublicKey('1iqoin4QcFPeVusTYdmQFZoonbZAXAhucvLxhpf78gN');
const DB_REF = process.env.WEBD_SUPABASE_PROJECT_REF || 'saneojmlgtmvtglgwdcj';
function sqlText(value){return `'${String(value??'').replaceAll("'","''")}'`;}
async function dbQuery(query){const token=process.env.WEBD_SUPABASE_MANAGEMENT_TOKEN;if(!token)return null;const r=await fetch(`https://api.supabase.com/v1/projects/${DB_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`Index database returned ${r.status}`);return r.json();}
async function savePrepared(record){return dbQuery(`insert into public.webd_launches (mint,name,symbol,description,domain_site,token_directory,metadata_uri,initial_buy_sol,status) values (${sqlText(record.mint)},${sqlText(record.name)},${sqlText(record.symbol)},${sqlText(record.description)},${sqlText(record.domainSite)},${sqlText(record.tokenDirectory)},${sqlText(record.metadataUri)},${sqlText(record.initialBuySol)},'prepared') on conflict (mint) do update set name=excluded.name,symbol=excluded.symbol,description=excluded.description,domain_site=excluded.domain_site,token_directory=excluded.token_directory,metadata_uri=excluded.metadata_uri,initial_buy_sol=excluded.initial_buy_sol,status='prepared'`);}
async function markConfirmed(mint,signature){return dbQuery(`update public.webd_launches set status='confirmed',signature=${sqlText(signature)} where mint=${sqlText(mint)}`);}
export async function listLaunches(){return (await dbQuery(`select mint,name,symbol,description,domain_site,token_directory,metadata_uri,image_url,initial_buy_sol,status,signature,created_at from public.webd_launches where status='confirmed' order by created_at desc limit 100`))||[];}

function readMultipart(req) {
  return new Promise((resolve, reject) => {
    const type = req.headers['content-type'] || '';
    if (!type.startsWith('multipart/form-data')) return reject(Object.assign(new Error('Use a token image and launch parameters.'), { status: 400 }));
    const bb = Busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024, fields: 4, files: 1 } });
    const fields = {}; let image;
    bb.on('field', (name, value) => { fields[name] = value; });
    bb.on('file', (name, stream, info) => { const chunks=[]; stream.on('data', c=>chunks.push(c)); stream.on('limit',()=>reject(Object.assign(new Error('Image must be 5 MB or smaller.'),{status:413}))); stream.on('end',()=>{image={buffer:Buffer.concat(chunks),type:info.mimeType||'application/octet-stream',name:info.filename};}); });
    bb.on('error', reject);
    bb.on('finish', () => resolve({ fields, image }));
    req.pipe(bb);
  });
}
function fail(message, status=400) { throw Object.assign(new Error(message), { status }); }
function validSite(value) { let u; try { u = new URL(String(value||'').trim()); } catch { fail('Paste a valid HTTPS domain link.'); } if (u.protocol !== 'https:' || u.username || u.password || u.hash) fail('Domain links must be HTTPS URLs without credentials or fragments.'); return u.toString(); }
async function uploadMetadata(mint, image, data, website) {
  if (!image?.buffer?.length) fail('Token image is required.');
  if (!['image/png','image/jpeg','image/webp','image/gif'].includes(image.type)) fail('Use a PNG, JPEG, WebP, or GIF image.');
  const form = new FormData(); form.set('file', new Blob([image.buffer], {type:image.type}), image.name || 'token-image'); form.set('name',data.name); form.set('symbol',data.symbol); form.set('description',data.description); form.set('showName','true'); form.set('website',website);
  const r = await fetch('https://pump.fun/api/ipfs',{method:'POST',body:form,signal:AbortSignal.timeout(25000)}); if(!r.ok) fail(`Pump metadata upload failed (${r.status}).`,502);
  const j=await r.json(); if(!j.metadataUri) fail('Pump returned no metadata URI.',502); return j.metadataUri;
}
export async function directPrepare(req) {
  const {fields,image}=await readMultipart(req); let body; try { body=JSON.parse(fields.launch||'{}'); } catch { fail('Invalid launch parameters.'); }
  const wallet = new PublicKey(String(body.wallet||'')); if(!PublicKey.isOnCurve(wallet.toBytes())) fail('A signing wallet is required.');
  const name=String(body.name||'').trim(), symbol=String(body.symbol||'').trim().toUpperCase(), description=String(body.description||'').trim(), website=validSite(body.domainUrl);
  const budgetText=String(body.initialBuySol||'0.05'); if(!/^(?:\d+)(?:\.\d{1,9})?$/.test(budgetText)) fail('Initial buy must be a SOL amount.');
  const budgetLamports = BigInt(Math.round(Number(budgetText)*1e9)); if(budgetLamports<50_000_000n || !Number.isSafeInteger(Number(budgetLamports))) fail('Initial buy must be at least 0.05 SOL.');
  if(!name || new TextEncoder().encode(name).length>32 || !/^[A-Z0-9]{2,10}$/.test(symbol) || description.length>2000) fail('Invalid name, ticker, or description.');
  const rpc=process.env.PUMP_RPC_URL||process.env.LOOT_RPC_URL||'https://api.mainnet-beta.solana.com'; const connection=new Connection(rpc,'confirmed');
  const online=new OnlinePumpSdk(connection); const [global,feeConfig]=await Promise.all([online.fetchGlobal(),online.fetchFeeConfig()]);
  const quoteAmount=new BN(budgetLamports.toString()); const amount=getBuyTokenAmountFromSolAmount({global,feeConfig,mintSupply:null,bondingCurve:null,amount:quoteAmount,quoteMint:NATIVE_MINT}); if(amount.isZero()) fail('Pump returned a zero-token quote.',422);
  const mint=Keypair.generate(); const tokenDirectory=`https://politic.fun/${mint.publicKey.toBase58()}`; const uri=await uploadMetadata(mint.publicKey,image,{name,symbol,description},tokenDirectory); const latest=await connection.getLatestBlockhash('confirmed');
  const create=await PUMP_SDK.createV2Instruction({mint:mint.publicKey,user:wallet,creator:TREASURY,name,symbol,uri,mayhemMode:false,holderReward:false,cashback:false});
  const ata=getAssociatedTokenAddressSync(mint.publicKey,wallet,true,TOKEN_2022_PROGRAM_ID);
  const buy=await PUMP_SDK.getBuyV2InstructionRaw({user:wallet,mint:mint.publicKey,creator:TREASURY,amount,quoteAmount,feeRecipient:global.feeRecipient,buybackFeeRecipient:global.buybackFeeRecipients[0],tokenProgram:TOKEN_2022_PROGRAM_ID,quoteMint:NATIVE_MINT,quoteTokenProgram:TOKEN_PROGRAM_ID});
  const createMessage=new TransactionMessage({payerKey:wallet,recentBlockhash:latest.blockhash,instructions:[create]}).compileToV0Message(); const createTx=new VersionedTransaction(createMessage); createTx.sign([mint]);
  const buyLatest=await connection.getLatestBlockhash('confirmed'); const buyMessage=new TransactionMessage({payerKey:wallet,recentBlockhash:buyLatest.blockhash,instructions:[createAssociatedTokenAccountIdempotentInstruction(wallet,ata,wallet,mint.publicKey,TOKEN_2022_PROGRAM_ID),buy]}).compileToV0Message(); const buyTx=new VersionedTransaction(buyMessage);
  if(createTx.serialize().length>1232||buyTx.serialize().length>1232) fail('Launch transaction is too large for Solana packet limits.',422);
  // The create transaction is only partially signed here: the mint is signed, but Phantom must still sign the payer. Do not simulate it before the wallet signs, because RPC rejects that incomplete transaction and prevents the Phantom prompt. directConfirm performs preflight when the fully signed transaction is submitted.
  const result={ intentId:mint.publicKey.toBase58(),mint:mint.publicKey.toBase58(),website:tokenDirectory,domainSite:website,tokenDirectory,transactions:[{phase:'create',transaction:Buffer.from(createTx.serialize()).toString('base64')},{phase:'buy',transaction:Buffer.from(buyTx.serialize()).toString('base64')}],estimatedBuySol:budgetText,creatorFeeWallet:TREASURY.toBase58(),name,symbol,description,metadataUri:uri }; await savePrepared({mint:mint.publicKey.toBase58(),name,symbol,description,domainSite:website,tokenDirectory,metadataUri:uri,initialBuySol:budgetText}); return result;
}
export async function directConfirm(body) {
  const mint=new PublicKey(String(body.intentId||'')); const encoded=String(body.transaction||''); if(!encoded||encoded.length>10000) fail('The signed launch transaction is required.'); const tx=VersionedTransaction.deserialize(Buffer.from(encoded,'base64')); const keys=tx.message.staticAccountKeys.map(k=>k.toBase58()); if(!keys.includes(mint.toBase58())) fail('Signed transaction does not match the launch intent.');
  const connection=new Connection(process.env.PUMP_RPC_URL||process.env.LOOT_RPC_URL||'https://api.mainnet-beta.solana.com','confirmed'); const signature=await connection.sendRawTransaction(tx.serialize(),{skipPreflight:false,maxRetries:3}); const result=await connection.confirmTransaction(signature,'confirmed'); if(result.value.err) fail('Launch transaction failed on Solana.',422); await markConfirmed(mint.toBase58(),signature); return {status:'confirmed',mint:mint.toBase58(),signature,website:`https://politic.fun/${mint.toBase58()}`,tokenDirectory:`https://politic.fun/${mint.toBase58()}`};
}
