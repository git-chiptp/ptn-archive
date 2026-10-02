import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ArchiveStore } from '../../services/archive.store';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './event-story.page.html',
})
export class EventStoryPage {
  readonly store = inject(ArchiveStore);
  readonly auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  public get isAdmin() { 
    return !!this.auth.user(); 
  }
  
  public get event() {
    const id = this.route.snapshot.paramMap.get('eventId');
    return this.store.collections('event-story').find((collection) => collection.id === id);
  }
}
