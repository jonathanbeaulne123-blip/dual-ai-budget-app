import {createContext,useContext} from 'react';
import type {LookV1} from '../core/herculesCompanionContracts.ts';
export const WornLookContext=createContext<LookV1|null>(null);
export const useWornLook=()=>useContext(WornLookContext);
