import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProcessData { systems: SystemItem[]; riskLevels: RiskLevel[]; categories: Category[]; groups: Group[]; subgroups: Subgroup[]; macroprocesses: Macroprocess[]; processes: ProcessItem[]; }
export interface SystemItem { id: string; name: string; favorite: boolean; }
export interface RiskLevel { id: string; label: string; colorVar: string; }
export interface Category { id: string; title: string; className: string; description: string; }
export interface Group { id: string; categoryId: string; title: string; }
export interface Subgroup { id: string; groupId: string; title: string; }
export interface Macroprocess { id: string; categoryId: string; label: string; description: string; }
export interface ProcessItem { id: string; label: string; macroprocessId?: string; groupId?: string; subgroupId?: string; risk: string | null; }

@Injectable({ providedIn: 'root' })
export class ProcessDataService {
  constructor(private readonly http: HttpClient) {}
  load(): Observable<ProcessData> { return this.http.get<ProcessData>('assets/data.json'); }
}
