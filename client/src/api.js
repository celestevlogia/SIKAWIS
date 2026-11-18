const BASE="http://localhost:4000/api";
export const token=()=>sessionStorage.getItem("sikawis_token");
export async function api(path,options={}){
  const headers={...(options.body instanceof FormData?{}:{"Content-Type":"application/json"}),...(token()?{Authorization:`Bearer ${token()}`}:{}) ,...(options.headers||{})};
  const res=await fetch(BASE+path,{...options,headers});
  const data=await res.json().catch(()=>({message:"Respons server tidak valid."}));
  if(!res.ok) throw new Error(data.message||"Permintaan gagal.");
  return data;
}
export const post=(path,body)=>api(path,{method:"POST",body:body instanceof FormData?body:JSON.stringify(body)});
export const put=(path,body)=>api(path,{method:"PUT",body:JSON.stringify(body)});
