import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category, Macroprocess, ProcessData, ProcessDataService, ProcessItem, RiskLevel, SystemItem } from './process-data.service';

interface ProcessLink { id: string; label: string; type: 'macro' | 'process'; }
interface RiskProcess { name: string; risk: string; }
interface Detail { label: string; description: string; processes: RiskProcess[]; }

const AUTH_HASH = 'bf6b5bdb74c79ece9fc0ad0ac9fb0359f9555d4f35a83b2e6ec69ae99e09603d';
const AUTH_SESSION_KEY = 'procesos-auth-ok';
const MAP_SYSTEM_ID = 'mapa-de-procesos';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  authenticated = sessionStorage.getItem(AUTH_SESSION_KEY) === '1';
  username = '';
  password = '';
  loginError = '';
  searchTerm = '';
  activeView: 'all' | 'favorites' = 'all';
  selectedSystemId = MAP_SYSTEM_ID;
  sidebarCollapsed = false;
  listCollapsed = false;
  sessionSeconds = 56 * 60 + 15;
  route = window.location.hash;
  loadingError = '';

  systems: SystemItem[] = [];
  riskLevels: RiskLevel[] = [];
  processGroups: any[] = [];
  private readonly favorites = new Set<string>();
  private readonly macros = new Map<string, Detail>();
  private readonly categoryDetails = new Map<string, Detail>();
  private readonly processCatalog = new Map<string, { label: string; category: string }>();

  constructor(private readonly dataService: ProcessDataService) {}

  ngOnInit(): void {
    window.setInterval(() => this.sessionSeconds = Math.max(0, this.sessionSeconds - 1), 1000);
    this.dataService.load().subscribe({
      next: (data) => this.initializeData(data),
      error: () => this.loadingError = 'No se pudo cargar la información del mapa de procesos.'
    });
  }

  get visibleSystems(): SystemItem[] {
    const query = this.searchTerm.trim().toLocaleLowerCase('es');
    return this.systems
      .filter((system) => system.name.toLocaleLowerCase('es').includes(query) && (this.activeView === 'all' || this.favorites.has(system.id)))
      .sort((first, second) => {
        if (first.id === MAP_SYSTEM_ID) return -1;
        if (second.id === MAP_SYSTEM_ID) return 1;
        return Number(this.favorites.has(second.id)) - Number(this.favorites.has(first.id));
      });
  }

  get systemCount(): number { return this.activeView === 'all' ? this.systems.length : this.favorites.size; }
  get sessionTime(): string { return `${Math.floor(this.sessionSeconds / 60)} M : ${String(this.sessionSeconds % 60).padStart(2, '0')} S`; }
  get isMapVisible(): boolean { return !this.activeMacro && !this.activeProcess && this.selectedSystemId === MAP_SYSTEM_ID; }
  get isGenericSystem(): boolean { return !this.activeMacro && !this.activeProcess && this.selectedSystemId !== MAP_SYSTEM_ID; }
  get activeProcess(): { label: string; category: string } | undefined {
    return this.processCatalog.get(this.matchRoute('proceso'));
  }
  get activeMacro(): Detail | undefined {
    return this.categoryDetails.get(this.matchRoute('categoria')) ?? this.macros.get(this.matchRoute('macro'));
  }
  get macroSubtitle(): string { return this.route.startsWith('#categoria-') ? 'Macroproceso' : 'Macroproceso estratégico'; }

  @HostListener('window:hashchange')
  onHashChange(): void { this.route = window.location.hash; }

  async login(): Promise<void> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${this.username.trim()}:${this.password}`));
    const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    if (hash === AUTH_HASH) {
      sessionStorage.setItem(AUTH_SESSION_KEY, '1');
      this.authenticated = true;
      this.username = '';
      this.password = '';
      this.loginError = '';
      return;
    }
    this.password = '';
    this.loginError = 'Usuario o contraseña incorrectos.';
  }

  selectSystem(id: string): void {
    if (this.route.startsWith('#proceso-') || this.route.startsWith('#macro-')) window.location.hash = '#mapa';
    this.selectedSystemId = id;
  }

  toggleFavorite(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.favorites.has(id) ? this.favorites.delete(id) : this.favorites.add(id);
  }

  isFavorite(id: string): boolean { return this.favorites.has(id); }
  processRoute(item: ProcessLink): string { return `#${item.type === 'macro' ? 'macro' : 'proceso'}-${item.id}`; }
  riskColor(label: string): string { return `var(${this.riskLevels.find((level) => level.label === label)?.colorVar ?? '--muted'})`; }
  riskCount(detail: Detail, label: string): number { return detail.processes.filter((process) => process.risk === label).length; }
  riskPercent(detail: Detail, label: string): number { return Math.round(this.riskCount(detail, label) / detail.processes.length * 100); }
  riskGradient(detail: Detail): string {
    let cumulative = 0;
    return this.riskLevels.map((level) => {
      const start = cumulative / detail.processes.length * 100;
      cumulative += this.riskCount(detail, level.label);
      return `${this.riskColor(level.label)} ${start}% ${cumulative / detail.processes.length * 100}%`;
    }).join(', ');
  }

  private matchRoute(prefix: string): string {
    return this.route.match(new RegExp(`^#${prefix}-([a-z0-9-]+)$`))?.[1] ?? '';
  }

  private initializeData(data: ProcessData): void {
    this.systems = data.systems;
    data.systems.filter((system) => system.favorite).forEach((system) => this.favorites.add(system.id));
    this.riskLevels = data.riskLevels;
    this.processGroups = data.categories.map((category) => this.buildGroup(category, data));

    data.macroprocesses.filter((macro) => macro.categoryId === 'strategic').forEach((macro) => {
      this.macros.set(macro.id, { ...macro, processes: data.processes.filter((process) => process.macroprocessId === macro.id).map((process) => ({ name: process.label, risk: process.risk ?? 'Bajo' })) });
    });

    this.processGroups.forEach((level) => {
      (level.items ?? []).filter((item: ProcessLink) => item.type === 'macro').forEach((item: ProcessLink) => this.processCatalog.set(item.id, { label: item.label, category: level.title }));
      (level.groups ?? []).forEach((group: any) => [...group.items, ...group.subgroups.flatMap((subgroup: any) => subgroup.items)].forEach((item: ProcessLink) => this.processCatalog.set(item.id, { label: item.label, category: `${level.title} · ${group.title}` })));
    });

    data.categories.forEach((category) => this.categoryDetails.set(category.id, this.buildCategoryDetail(category, data)));
  }

  private buildGroup(category: Category, data: ProcessData): any {
    if (category.id === 'strategic') {
      return { ...category, items: data.macroprocesses.filter((macro) => macro.categoryId === category.id).map((macro) => ({ id: macro.id, label: macro.label, type: 'macro' as const })) };
    }
    return {
      ...category,
      groups: data.groups.filter((group) => group.categoryId === category.id).map((group) => ({
        ...group,
        items: data.processes.filter((process) => process.groupId === group.id).map((process) => ({ id: process.id, label: process.label, type: 'process' as const })),
        subgroups: data.subgroups.filter((subgroup) => subgroup.groupId === group.id).map((subgroup) => ({
          ...subgroup,
          items: data.processes.filter((process) => process.subgroupId === subgroup.id).map((process) => ({ id: process.id, label: process.label, type: 'process' as const }))
        }))
      }))
    };
  }

  private buildCategoryDetail(category: Category, data: ProcessData): Detail {
    const level = this.processGroups.find((item) => item.id === category.id);
    const entries: Array<RiskProcess | ProcessLink> = category.id === 'strategic'
      ? [...this.macros.values()].flatMap((macro) => macro.processes)
      : level.groups.flatMap((group: any) => [...group.items, ...group.subgroups.flatMap((subgroup: any) => subgroup.items)]);
    const offset = category.id === 'mission' ? 1 : 2;
    return {
      label: category.title,
      description: category.description,
      processes: entries.map((entry, index) => this.toRiskProcess(entry, index, offset))
    };
  }

  private toRiskProcess(entry: RiskProcess | ProcessLink, index: number, offset: number): RiskProcess {
    if ('risk' in entry) return entry;
    return {
      name: entry.label,
      risk: this.riskLevels[(index + offset) % this.riskLevels.length].label
    };
  }
}
