import {getStore} from '@/lib/store';import {publishedPage} from '@/lib/public';import {PublicPage} from '@/components/public-page';import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;const page=getStore().read().data.pages.find(p=>p.id===id&&p.published&&!p.deletedAt);if(!page)notFound();return <PublicPage page={publishedPage(page)}/>;}
