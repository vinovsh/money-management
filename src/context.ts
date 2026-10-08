import {createContext,useContext} from 'react';
import type {Ledger,Transaction} from './models';
export type AppState={ledger:Ledger;busy:boolean;act:(operation:()=>Promise<unknown>)=>Promise<boolean>;add:()=>void;edit:(t:Transaction)=>void;page:(p:string)=>void;undo:(t:Transaction)=>void};
export const AppContext=createContext<AppState|null>(null);
export function useApp(){const c=useContext(AppContext);if(!c)throw new Error('App is still loading.');return c;}
