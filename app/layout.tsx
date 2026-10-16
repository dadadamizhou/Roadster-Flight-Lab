import type { Metadata, Viewport } from 'next';
import './game-viewport.css';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#080e12'};
export const metadata:Metadata={title:'ROADSTER / FLIGHT LAB',description:'驾驶喷气跑车，穿越城市、山谷与星际赛道。管理电量与气压，挑战计时排行榜。',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body style={{margin:0,background:'#080e12'}}>{children}</body></html>;}
