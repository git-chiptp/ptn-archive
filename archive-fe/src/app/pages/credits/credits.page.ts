import { Component, inject } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { LanguageService } from '../../services/language.service';

@Component({
  standalone: true,
  imports: [BreadcrumbModule],
  templateUrl: './credits.page.html',
})
export class CreditsPage {
  public readonly language = inject(LanguageService);
  public readonly breadcrumbHome: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  public get breadcrumbItems(): MenuItem[] {
    return [{ label: this.language.text('contributors') }];
  }
}
