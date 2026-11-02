import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImageModule } from 'primeng/image';
import { LanguageService } from '../../services/language.service';

@Component({
  standalone: true,
  imports: [ImageModule, RouterLink],
  selector: 'app-mirror-system',
  templateUrl: './mirror-system.html',
})
export class MirrorSystem {
  public readonly language = inject(LanguageService);

  links = [
    {
      path: '/mirror-system/chronology',
      key: 'chronology',
      image: '/img/menu/chronology.webp',
    },
    {
      path: '/discity',
      key: 'discity',
      image: '/img/menu/discity.webp',
    },
    {
      path: '/mania',
      key: 'mania',
      image: '/img/menu/mania.webp',
    },
  ];
}
