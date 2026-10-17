'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '../../context/AuthContext';
import {createClient} from '../../lib/supabase/client';
export function CatalogAdminLink(){const {user}=useAuth();const [adminId,setAdminId]=useState<string|null>(null);useEffect(()=>{if(!user)return;let active=true;void createClient().rpc('is_music_admin').then(({data,error})=>{if(active)setAdminId(!error&&data?user.id:null);});return()=>{active=false;};},[user]);return user&&adminId===user.id?<p><Link href="/admin/music">♫ Управление музыкальным каталогом</Link></p>:null;}
