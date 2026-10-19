import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../services/language.service';

@Pipe({ name: 'ui', standalone: true, pure: false })
export class UiTextPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  public transform(key: string, params?: Record<string, string>): string {
    return this.language.text(key, params);
  }
}
