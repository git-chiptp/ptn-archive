import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService } from '../../services/language.service';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ImageModule } from 'primeng/image';
@Component({
  standalone: true,
  imports: [ButtonModule, CardModule, ImageModule],
  templateUrl: './home.page.html',
})
export class HomePage {
  private readonly router = inject(Router);

  public readonly language = inject(LanguageService);

  links = [
    {
      path: '/main-story',
      key: 'mainStory',
      image: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=1200&q=80',
    },
    {
      path: '/event-story',
      key: 'eventStory',
      image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1200&q=80',
    },
    {
      path: '/eternal-nightmare',
      key: 'eternalNightmare',
      image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&q=80',
    },
    {
      path: '/interrogation',
      key: 'interrogation',
      image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&q=80',
    },
    {
      path: '/mirage',
      key: 'mirage',
      image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&q=80',
    },
    {
      path: '/perspectra',
      key: 'perspectra',
      image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80',
    },
  ];

  navigate(path: string) {
    this.router.navigateByUrl(path);
  }
}
