"""One explicitly authorized DTDC live test. No automatic booking retries."""
import sys
import paramiko
from deploy import APP_DIR, VPS_HOST, VPS_USER, VPS_PASS

if sys.argv[1:] != ['--execute-once']:
    raise SystemExit('Requires --execute-once')

js = r'''
const {loadEnvConfig}=require('@next/env');
loadEnvConfig(process.cwd());
const {MongoClient}=require('mongodb');
const fs=require('fs');
const reference='OMS-TEST-20261012-A93F7C';
const marker='/tmp/99store-dtdc-test-20261012-A93F7C.json';
(async()=>{
 const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:15000});
 try {
  await client.connect();
  const db=client.db('99store-oms');
  const settings=await db.collection('settings').findOne({key:'system-settings'});
  const local=JSON.parse(fs.readFileSync('data/db.json','utf8'));
  const c={...local.settings?.dtdcConfig,...settings?.dtdcConfig};
  const apiKey=process.env.DTDC_API_KEY||c.apiKey;
  const customerCode=process.env.DTDC_CUSTOMER_CODE||c.customerCode;
  if(!apiKey||!customerCode)throw new Error('Missing booking credentials');
  for(const k of ['contactName','phone','address','pincode','city','state'])if(!c[k])throw new Error('Missing warehouse field: '+k);
  if(await db.collection('courierLogs').findOne({requestPayload:{$regex:reference}}))throw new Error('Test reference already exists');
  const origin={name:c.contactName,phone:c.phone,alternate_phone:'',address_line_1:c.address,address_line_2:c.address2||'',pincode:c.pincode,city:c.city,state:c.state};
  const payload={consignments:[{
   customer_code:customerCode,service_type_id:c.serviceTypeId||'B2C PRIORITY',
   load_type:'NON-DOCUMENT',consignment_type:'Forward',dimension_unit:'cm',length:'10.0',width:'10.0',height:'10.0',
   weight_unit:'kg',weight:'0.2',declared_value:'100',num_pieces:'1',origin_details:origin,
   destination_details:{...origin,name:'OMS TEST RECIPIENT - DO NOT DISPATCH'},
   customer_reference_number:reference,commodity_id:c.commodityId||'2',description:'AUTHORIZED API TEST ONLY - NO PHYSICAL PARCEL - DO NOT DISPATCH',reference_number:''
  }]};
  // Persist the attempt before calling DTDC. An uncertain response must never cause a second booking.
  fs.writeFileSync(marker,JSON.stringify({reference,attemptedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({reference,environment:'production',origin:origin.pincode,destination:origin.pincode,recipient:'OMS TEST RECIPIENT - DO NOT DISPATCH',weightKg:0.2,declaredValue:100,codAmount:0}));
  const r=await fetch('https://pxapi.dtdc.in/api/customer/integration/consignment/softdata',{
   method:'POST',redirect:'error',headers:{'Content-Type':'application/json','api-key':apiKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)
  });
  const raw=await r.text();let response;try{response=JSON.parse(raw)}catch{response={nonJsonResponse:true}};
  const result={reference,httpStatus:r.status,response};
  fs.writeFileSync(marker,JSON.stringify(result),{mode:0o600});
  console.log(JSON.stringify(result));
  const awb=response?.data?.[0]?.reference_number||response?.reference_number;
  if(awb){
   const orders=await db.collection('orders').find({awb},{projection:{_id:0,orderId:1,createdAt:1}}).toArray();
   const olderLogs=await db.collection('courierLogs').find({$or:[{requestPayload:{$regex:awb}},{responsePayload:{$regex:awb}}]},{projection:{_id:0,timestamp:1,action:1,status:1}}).limit(5).toArray();
   console.log(JSON.stringify({awb,existingOmsOrders:orders,existingLogs:olderLogs}));
  }
 }finally{await client.close()}
})().catch(e=>{console.error('Test stopped: '+e.message+'. Do not retry a booking automatically.');process.exitCode=1});
'''
client=paramiko.SSHClient()
client.load_system_host_keys()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(VPS_HOST,username=VPS_USER,password=VPS_PASS,timeout=20)
    stdin,stdout,stderr=client.exec_command('cd '+APP_DIR+' && node',timeout=90)
    stdin.write(js)
    stdin.channel.shutdown_write()
    print(stdout.read().decode('utf-8',errors='replace'))
    print(stderr.read().decode('utf-8',errors='replace'))
    sys.exit(stdout.channel.recv_exit_status())
finally:
    client.close()
