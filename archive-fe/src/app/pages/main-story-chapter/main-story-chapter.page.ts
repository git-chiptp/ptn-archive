import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ArchiveStore } from '../../services/archive.store';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './main-story-chapter.page.html',
})
export class MainStoryChapterPage {
  readonly store = inject(ArchiveStore);

  readonly auth = inject(AuthService);

  private route = inject(ActivatedRoute);

  public get isAdmin() { 
    return !!this.auth.user(); 
  }
  
  public get chapter() {
    const id = this.route.snapshot.paramMap.get('chapterId');
    return this.store.collections('main-story').find((collection) => collection.id === id);
  }
}
