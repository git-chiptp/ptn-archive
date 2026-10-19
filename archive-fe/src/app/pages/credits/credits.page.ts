import { Component } from '@angular/core';
import { inject } from '@angular/core';
import { LanguageService } from '../../services/language.service';

@Component({
  standalone: true,
  templateUrl: './credits.page.html',
})
export class CreditsPage {
  public readonly language = inject(LanguageService);
}
