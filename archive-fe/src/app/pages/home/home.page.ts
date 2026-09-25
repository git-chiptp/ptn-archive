import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArchiveStore } from '../../services/archive.store';
import { inject } from '@angular/core';
@Component({
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.page.html',
})
export class HomePage {
  readonly store = inject(ArchiveStore);
  links = [
    {
      path: '/main-story',
      name: 'Main story',
      text: 'Follow the central journey across chapters and stages.',
    },
    {
      path: '/event-story',
      name: 'Event story',
      text: 'Discover stories between the main chapters.',
    },
    {
      path: '/interrogation',
      name: 'Interrogation',
      text: 'Listen closely. Every answer leaves a trace.',
    },
    {
      path: '/perspectra',
      name: 'Perspectra',
      text: 'Follow the same archive through different perspectives.',
    },
  ];
}
