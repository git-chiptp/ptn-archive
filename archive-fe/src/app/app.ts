import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LanguageCode, LanguageService } from './services/language.service';
import { RouterLink, RouterOutlet } from '@angular/router';
@Component({
  standalone: true,
  imports: [RouterOutlet, RouterLink, FormsModule],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  readonly language = inject(LanguageService);
  setLanguage(value: string) { this.language.setLanguage(value as LanguageCode); }
}
