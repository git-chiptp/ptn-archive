import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../../services/language.service';
import { ImageModule } from 'primeng/image';
@Component({
  standalone: true,
  imports: [ImageModule, RouterLink],
  templateUrl: './home.page.html',
})
export class HomePage {
  public readonly language = inject(LanguageService);

  links = [
    {
      path: '/glossary',
      key: 'glossary',
      image: '/img/menu/glossary.webp',
    },
    {
      path: '/main-story',
      key: 'mainStory',
      image: '/img/menu/main-story.webp',
    },
    {
      path: '/event-story',
      key: 'eventStory',
      image: '/img/menu/event.webp',
    },
    {
      path: '/eternal-nightmare',
      key: 'eternalNightmare',
      image: '/img/menu/en.webp',
    },
    {
      path: '/interrogation',
      key: 'interrogation',
      image: '/img/menu/interro.webp',
    },
    {
      path: '/mirage',
      key: 'mirage',
      image: '/img/menu/mirage.webp',
    },
    {
      path: '/perspectra',
      key: 'perspectra',
      image: '/img/menu/perspectra.webp',
    },
  ];
}
