import { getStore } from "@netlify/blobs";
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
export default async (req)=>{
  const path=new URL(req.url).pathname.replace(/^\/api\/?/,"");
  const db=getStore("oi-life");
  if(req.method==="GET"&&path==="posts")return json(await db.get("posts",{type:"json"}));
  if(req.method==="GET"&&path==="ads")return json((await db.get("ads",{type:"json"}))||{});
  if(req.method==="GET"&&path.startsWith("img/")){
    const id=path.slice(4);
    if(!/^[a-z0-9]+$/.test(id))return new Response("Not found",{status:404});
    const d=await db.get("img-"+id);
    const m=d&&d.match(/^data:(.+?);base64,(.*)$/);
    if(!m)return new Response("Not found",{status:404});
    return new Response(Buffer.from(m[2],"base64"),{headers:{"content-type":m[1],"cache-control":"public, max-age=31536000"}});
  }
  if(req.method==="POST"&&path==="subscribe"){
    const b=await req.json().catch(()=>({}));
    const e=String(b.email||"").trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)||e.length>120)return json({error:"Enter a valid email address."},400);
    const list=(await db.get("subs",{type:"json"}))||[];
    if(list.length>=5000)return json({error:"Try again later."},400);
    if(!list.includes(e)){list.push(e);await db.setJSON("subs",list)}
    return json({ok:true});
  }
  const pw=process.env.ADMIN_PASSWORD;
  if(!pw||req.headers.get("x-admin-password")!==pw)return json({error:"Wrong password"},401);
  if(req.method==="POST"&&path==="login")return json({ok:true});
  if(req.method==="GET"&&path==="subscribers")return json((await db.get("subs",{type:"json"}))||[]);
  if(req.method==="PUT"&&path==="posts"){
    const b=await req.json();
    if(!Array.isArray(b))return json({error:"Bad data"},400);
    await db.setJSON("posts",b);return json({ok:true});
  }
  if(req.method==="PUT"&&path==="ads"){
    const b=await req.json();
    if(!b||typeof b!=="object"||Array.isArray(b))return json({error:"Bad data"},400);
    const out={};let n=0;
    for(const k of Object.keys(b)){if(typeof b[k]==="string"&&/^ad-[a-z-]+$/.test(k)){out[k]=b[k];n+=b[k].length}}
    if(n>300000)return json({error:"Too large"},400);
    await db.setJSON("ads",out);return json({ok:true});
  }
  if(req.method==="POST"&&path==="img"){
    const b=await req.json();
    if(typeof b.data!=="string"||!b.data.startsWith("data:image/")||b.data.length>3000000)return json({error:"Bad image"},400);
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    await db.set("img-"+id,b.data);return json({url:"/api/img/"+id});
  }
  return json({error:"Not found"},404);
};
export const config={path:"/api/*"};
