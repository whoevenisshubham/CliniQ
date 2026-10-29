import {redirect} from "next/navigation";
export default async function Page({searchParams}:{searchParams:Promise<{id?:string}>}){const id=(await searchParams).id;redirect(id&&id!=="new"?"/consultations?id="+encodeURIComponent(id):"/consultations");}
