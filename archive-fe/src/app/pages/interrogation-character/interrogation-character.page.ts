import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ArchiveStore } from '../../services/archive.store';
import { AuthService } from '../../services/auth.service';

@Component({ 
  standalone: true, 
  imports: [CommonModule, RouterLink], 
  templateUrl: './interrogation-character.page.html' 
})
export class InterrogationCharacterPage {
  readonly store = inject(ArchiveStore); readonly auth = inject(AuthService); private route = inject(ActivatedRoute); private router = inject(Router);

  public get character() {
    return this.route.snapshot.paramMap.get('characterId') ?? '';
  }

  public get parts() {
    return this.store.transcripts().filter((t) => t.category === 'interrogation' && this.slug(t.parentLabel) === this.character);
  }

  public addPart() {
    this.router.navigate(['/add-transcript'], { queryParams: { category: 'interrogation', parentLabel: this.character } });
  }

  public editCharacter() {
    const next = prompt('Character name', this.character);
    if (!next?.trim() || next.trim() === this.character) {
      return;
    }
    this.parts.forEach((t) => this.store.update({
      ...t,
      parentLabel: next.trim(),
      parentId: this.slug(next.trim())
    }));
    this.router.navigate(['/interrogation', this.slug(next.trim())]);
  }

  public deleteCharacter() {
    if (confirm('Delete this character and all its parts?')) {
      this.parts.forEach((t) => this.store.remove(t.id));
    }
  }

  public deletePart(id: string) {
    if (confirm('Delete this part?')) {
      this.store.remove(id);
    }
  }

  private slug(value: string) {
    return value.toLowerCase().trim().replace(/\s+/g, '-');
  }
}
