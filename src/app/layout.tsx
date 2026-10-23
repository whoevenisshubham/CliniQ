import type { Metadata } from 'next';
import {Geist,Geist_Mono} from 'next/font/google';
import './globals.css';
import {ThemeProvider} from '@/components/shared/ThemeProvider';
const sans=Geist({variable:'--font-geist-sans',subsets:['latin']});
const mono=Geist_Mono({variable:'--font-geist-mono',subsets:['latin']});
export const metadata:Metadata={title:'CLINIQ+ · Records for every visit',description:'Private health records and clinician-reviewed documentation. An educational synthetic-data product in development.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body className={`${sans.variable} ${mono.variable} antialiased`}><ThemeProvider>{children}</ThemeProvider></body></html>}
