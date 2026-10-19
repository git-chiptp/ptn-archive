import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NavigationLayoutService {
  public readonly collapsed = signal(
    typeof localStorage !== 'undefined' && localStorage.getItem('archive-sidebar-collapsed') === 'true',
  );

  public toggle() {
    const collapsed = !this.collapsed();
    this.collapsed.set(collapsed);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('archive-sidebar-collapsed', String(collapsed));
    }
  }
}
