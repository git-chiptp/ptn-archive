import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Category } from '../../models/transcript.models';
import { AuthService } from '../../services/auth.service';
import { ArchiveStore } from '../../services/archive.store';
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './catalog.page.html',
})
export class CatalogPage {
  private store = inject(ArchiveStore);

  readonly auth = inject(AuthService);

  public get isAdmin() { 
    return !!this.auth.user(); 
  }
  
  private route = inject(ActivatedRoute);
  
  public query = '';
  
  public category = this.route.snapshot.data['category'] as Category;
  
  public get label() {
    return this.category === 'main-story'
      ? 'THE MAIN STORY'
      : this.category === 'event-story'
        ? 'EVENT STORIES'
        : this.category === 'perspectra' ? 'PERSPECTRA' : 'INTERROGATION FILES';
  }
  
  public get title() {
    return this.category === 'main-story'
      ? 'Main story'
      : this.category === 'event-story'
        ? 'Event story'
        : this.category === 'perspectra' ? 'Perspectra' : 'Interrogation';
  }

  public get description() {
    return this.category === 'main-story'
      ? 'The central route through a world that is still becoming.'
      : this.category === 'event-story'
        ? 'Side stories, seasonal moments, and voices between the lines.'
        : this.category === 'perspectra' ? 'Stories told through the eyes of different witnesses.' : 'Recorded conversations from the people closest to the truth.';
  }
  
  public get filteredCollections() {
    const q = this.query.toLowerCase();
    return this.store
      .collections(this.category)
      .map((c) => ({
        ...c,
        stages: c.stages.filter((s) => !q || `${c.label} ${s.label}`.toLowerCase().includes(q)),
      }))
      .filter((c) => this.category === 'main-story' || this.category === 'event-story' || c.stages.length);
  }
}
